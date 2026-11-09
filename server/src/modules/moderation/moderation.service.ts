import { resourceId } from '../../common/contentVisibility.js'
import { Types, FilterQuery } from 'mongoose'
import type { IStory } from '../../models/Story.model.js'
import type { IChapter } from '../../models/Chapter.model.js'
import type { CommentDocument } from '../../models/Comment.model.js'
import type { IUser } from '../../models/User.model.js'
import { storyRepository } from '../../repositories/story.repository.js'
import { chapterRepository } from '../../repositories/chapter.repository.js'
import { commentRepository } from '../../repositories/comment.repository.js'
import { userRepository } from '../../repositories/user.repository.js'
import { reportRepository } from '../../repositories/report.repository.js'
import { moderationLogRepository } from '../../repositories/moderation-log.repository.js'
import { notificationsService } from '../notifications/notifications.service.js'
import { emitToModerators } from '../../config/socket.js'
import { AppError } from '../../common/AppError.js'
import { isAccountLocked } from '../../common/accountState.js'
import { logger } from '../../common/logger.js'
import type { CreateNotificationInput } from '../../repositories/notification.repository.js'

// Moderation is already committed; delivery failures must not imply a rolled-back decision.
const notifyAfterCommit = async (userId: string, data: Omit<CreateNotificationInput, 'userId'>) => {
  try { await notificationsService.createAndEmitNotification(userId, data) }
  catch (error) { logger.error('Moderation notification delivery failed', { userId, error }) }
}
import {
  decodeCursor,
  encodeCursor,
  buildCursorMeta,
  CursorPaginationMeta,
} from '../../common/pagination.js'
import type {
  QueueQueryDto,
  ModerationActionDto,
  CreateReportDto,
  ReportActionDto,
  ReportsQueryDto,
  HistoryQueryDto,
} from './moderation.validation.js'

export const moderationService = {
  // ─── 1. Queue Summary ────────────────────────────────────────────────────────

  async getQueueSummary() {
    const [pendingStories, pendingChapters, spamComments, pendingReports] = await Promise.all([
      storyRepository.countPendingModeration(),
      chapterRepository.countPendingModeration(),
      commentRepository.countSpamQueue(),
      reportRepository.countPending(),
    ])

    return {
      pendingStories,
      pendingChapters,
      spamComments,
      pendingReports,
      totalPending: pendingStories + pendingChapters + spamComments + pendingReports,
    }
  },

  // ─── 2. Story Queue & Actions ───────────────────────────────────────────────

  async getStoryQueue(query: QueueQueryDto) {
    const { search, genre, sort = 'oldest', cursor, limit = 20 } = query

    const filter: FilterQuery<IStory> = {
      moderationStatus: 'pending',
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { description: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ]
    }

    if (genre && Types.ObjectId.isValid(genre)) {
      filter.genreIds = new Types.ObjectId(genre)
    }

    const sortDirection = sort === 'oldest' ? 1 : -1

    if (cursor) {
      const decoded = decodeCursor<{ createdAt: string; _id: string }>(cursor)
      if (!decoded || !Types.ObjectId.isValid(decoded._id) || typeof decoded.createdAt !== 'string' || !Number.isFinite(Date.parse(decoded.createdAt))) {
        throw AppError.badRequest('Cursor không hợp lệ', 'INVALID_CURSOR')
      }
      if (decoded) {
        const cursorDate = new Date(decoded.createdAt)
        const cursorId = new Types.ObjectId(decoded._id)

        if (sort === 'oldest') {
          filter.$and = [...(filter.$and || []), { $or: [
            { createdAt: { $gt: cursorDate } },
            { createdAt: cursorDate, _id: { $gt: cursorId } },
          ] }]
        } else {
          filter.$and = [...(filter.$and || []), { $or: [
            { createdAt: { $lt: cursorDate } },
            { createdAt: cursorDate, _id: { $lt: cursorId } },
          ] }]
        }
      }
    }

    const items = await storyRepository.findModerationQueue({
      filter,
      sortDirection,
      limit,
    })

    const hasMore = items.length > limit
    const stories = hasMore ? items.slice(0, limit) : items

    let nextCursor: string | null = null
    if (hasMore && stories.length > 0) {
      const last = stories[stories.length - 1]
      nextCursor = encodeCursor({
        createdAt: last.createdAt.toISOString(),
        _id: last._id.toString(),
      })
    }

    return {
      stories,
      meta: buildCursorMeta(limit, nextCursor, hasMore),
    }
  },

  async moderateStory(
    modId: string,
    storyId: string,
    action: 'approve' | 'hide' | 'remove' | 'request_revision',
    data: ModerationActionDto
  ) {
    if (!Types.ObjectId.isValid(storyId)) {
      throw AppError.badRequest('Story ID không hợp lệ')
    }

    const story = await storyRepository.findByIdForModeration(storyId)
    if (!story) {
      throw AppError.notFound('Truyện không tồn tại')
    }

    let newStatus: 'approved' | 'hidden' | 'removed' | 'pending'
    let actionName: string

    switch (action) {
      case 'approve':
        newStatus = 'approved'
        actionName = 'approve_story'
        break
      case 'hide':
        newStatus = 'hidden'
        actionName = 'hide_story'
        break
      case 'remove':
        newStatus = 'removed'
        actionName = 'remove_story'
        break
      case 'request_revision':
        newStatus = 'pending'
        actionName = 'request_revision_story'
        break
      default:
        throw AppError.badRequest('Hành động không hợp lệ')
    }

    story.moderationStatus = newStatus

    // Audit log
    await moderationLogRepository.saveWithLog(story, {
      moderatorId: modId,
      action: actionName,
      targetType: 'story',
      targetId: story._id,
      targetTitle: story.title,
      reason: data.reason,
      note: data.note,
    })

    // Notify author if requested
    if (data.notifyUser && story.authorId) {
      const authorIdStr =
        story.authorId && typeof story.authorId === 'object' && '_id' in story.authorId
          ? String((story.authorId as { _id: Types.ObjectId })._id)
          : String(story.authorId)

      const titleMap = {
        approve: `Truyện "${story.title}" của bạn đã được duyệt`,
        hide: `Truyện "${story.title}" tạm thời bị ẩn`,
        remove: `Truyện "${story.title}" đã bị gỡ bỏ`,
        request_revision: `Yêu cầu chỉnh sửa truyện "${story.title}"`,
      }

      await notifyAfterCommit(authorIdStr, {
        type: 'system',
        title: titleMap[action],
        message: data.reason ? `Lý do: ${data.reason}` : 'Vui lòng kiểm tra trong bảng điều khiển tác giả.',
        link: `/author/stories/${story._id}/edit`,
      })
    }

    try {
      emitToModerators('moderation:queue_updated', { type: 'story', action })
    } catch (err) {
      logger.warn('Failed to emit moderation:queue_updated for story:', err)
    }

    return story
  },

  // ─── 3. Chapter Queue & Actions ─────────────────────────────────────────────

  async getChapterQueue(query: QueueQueryDto) {
    const { search, sort = 'oldest', cursor, limit = 20 } = query

    const filter: FilterQuery<IChapter> = {
      moderationStatus: 'pending',
    }

    if (search) {
      filter.title = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    }

    const sortDirection = sort === 'oldest' ? 1 : -1

    if (cursor) {
      const decoded = decodeCursor<{ createdAt: string; _id: string }>(cursor)
      if (!decoded || !Types.ObjectId.isValid(decoded._id) || typeof decoded.createdAt !== 'string' || !Number.isFinite(Date.parse(decoded.createdAt))) {
        throw AppError.badRequest('Cursor không hợp lệ', 'INVALID_CURSOR')
      }
      if (decoded) {
        const cursorDate = new Date(decoded.createdAt)
        const cursorId = new Types.ObjectId(decoded._id)

        if (sort === 'oldest') {
          filter.$and = [...(filter.$and || []), { $or: [
            { createdAt: { $gt: cursorDate } },
            { createdAt: cursorDate, _id: { $gt: cursorId } },
          ] }]
        } else {
          filter.$and = [...(filter.$and || []), { $or: [
            { createdAt: { $lt: cursorDate } },
            { createdAt: cursorDate, _id: { $lt: cursorId } },
          ] }]
        }
      }
    }

    const items = await chapterRepository.findModerationQueue({
      filter,
      sortDirection,
      limit,
    })

    const hasMore = items.length > limit
    const chapters = hasMore ? items.slice(0, limit) : items

    let nextCursor: string | null = null
    if (hasMore && chapters.length > 0) {
      const last = chapters[chapters.length - 1]
      nextCursor = encodeCursor({
        createdAt: last.createdAt.toISOString(),
        _id: last._id.toString(),
      })
    }

    return {
      chapters,
      meta: buildCursorMeta(limit, nextCursor, hasMore),
    }
  },

  async moderateChapter(
    modId: string,
    chapterId: string,
    action: 'approve' | 'hide' | 'remove',
    data: ModerationActionDto
  ) {
    if (!Types.ObjectId.isValid(chapterId)) {
      throw AppError.badRequest('Chapter ID không hợp lệ')
    }

    const chapter = await chapterRepository.findByIdForModeration(chapterId)
    if (!chapter) {
      throw AppError.notFound('Chương không tồn tại')
    }

    let newStatus: 'approved' | 'hidden'
    let actionName: string

    switch (action) {
      case 'approve':
        newStatus = 'approved'
        actionName = 'approve_chapter'
        break
      case 'hide':
        newStatus = 'hidden'
        actionName = 'hide_chapter'
        break
      case 'remove':
        newStatus = 'hidden'
        actionName = 'remove_chapter'
        break
      default:
        throw AppError.badRequest('Hành động không hợp lệ')
    }

    const becamePublic = chapter.moderationStatus !== 'approved' && newStatus === 'approved' && chapter.status === 'published'
    chapter.moderationStatus = newStatus

    // Audit log
    await moderationLogRepository.saveWithLog(chapter, {
      moderatorId: modId,
      action: actionName,
      targetType: 'chapter',
      targetId: chapter._id,
      targetTitle: chapter.title,
      reason: data.reason,
      note: data.note,
    })

    // Notify author if requested
    const story = chapter.storyId as unknown as IStory
    if (data.notifyUser && story?.authorId) {
      const authorIdStr = resourceId(story.authorId)
      const titleMap = {
        approve: `Chương "${chapter.title}" đã được duyệt`,
        hide: `Chương "${chapter.title}" tạm thời bị ẩn`,
        remove: `Chương "${chapter.title}" bị gỡ bỏ`,
      }

      await notifyAfterCommit(authorIdStr, {
        type: 'system',
        title: titleMap[action],
        message: data.reason ? `Lý do: ${data.reason}` : `Thuộc tác phẩm "${story.title}".`,
        link: `/author/stories/${story._id}/chapters`,
      })
    }

    const storyId = resourceId(chapter.storyId)
    if (becamePublic) {
      const publicStory = await storyRepository.findById(storyId)
      if (publicStory) await notificationsService.notifyNewChapter(publicStory, chapter).catch(error => logger.error('Chapter notification delivery failed', error))
    }

    try {
      emitToModerators('moderation:queue_updated', { type: 'chapter', action })
    } catch (err) {
      logger.warn('Failed to emit moderation:queue_updated for chapter:', err)
    }

    return chapter
  },

  // ─── 4. Comment Queue & Actions ─────────────────────────────────────────────

  async getCommentQueue(query: QueueQueryDto) {
    const { search, sort = 'oldest', cursor, limit = 20 } = query

    const filter: FilterQuery<CommentDocument> = {
      $or: [{ spamScore: { $gt: 0 } }, { isLocked: true }, { isHidden: true }],
      isDeleted: false,
    }

    if (search) {
      filter.content = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    }

    const sortDirection = sort === 'oldest' ? 1 : -1

    if (cursor) {
      const decoded = decodeCursor<{ createdAt: string; _id: string }>(cursor)
      if (!decoded || !Types.ObjectId.isValid(decoded._id) || typeof decoded.createdAt !== 'string' || !Number.isFinite(Date.parse(decoded.createdAt))) {
        throw AppError.badRequest('Cursor không hợp lệ', 'INVALID_CURSOR')
      }
      if (decoded) {
        const cursorDate = new Date(decoded.createdAt)
        const cursorId = new Types.ObjectId(decoded._id)

        if (sort === 'oldest') {
          filter.$and = [...(filter.$and || []), { $or: [
            { createdAt: { $gt: cursorDate } },
            { createdAt: cursorDate, _id: { $gt: cursorId } },
          ] }]
        } else {
          filter.$and = [...(filter.$and || []), { $or: [
            { createdAt: { $lt: cursorDate } },
            { createdAt: cursorDate, _id: { $lt: cursorId } },
          ] }]
        }
      }
    }

    const items = await commentRepository.findSpamQueue({
      filter,
      sortDirection,
      limit,
    })

    const hasMore = items.length > limit
    const comments = hasMore ? items.slice(0, limit) : items

    let nextCursor: string | null = null
    if (hasMore && comments.length > 0) {
      const last = comments[comments.length - 1]
      nextCursor = encodeCursor({
        createdAt: last.createdAt.toISOString(),
        _id: last._id.toString(),
      })
    }

    return {
      comments,
      meta: buildCursorMeta(limit, nextCursor, hasMore),
    }
  },

  async moderateComment(
    modId: string,
    commentId: string,
    action: 'approve' | 'hide' | 'delete',
    data: ModerationActionDto
  ) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw AppError.badRequest('Comment ID không hợp lệ')
    }

    const comment = await commentRepository.findByIdForModeration(commentId)
    if (!comment) {
      throw AppError.notFound('Bình luận không tồn tại')
    }

    let actionName: string

    switch (action) {
      case 'approve':
        comment.spamScore = 0
        comment.isLocked = false
        comment.isHidden = false
        actionName = 'approve_comment'
        break
      case 'hide':
        comment.isHidden = true
        actionName = 'hide_comment'
        break
      case 'delete':
        comment.isDeleted = true
        actionName = 'delete_comment'
        break
      default:
        throw AppError.badRequest('Hành động không hợp lệ')
    }


    // Audit log
    await moderationLogRepository.saveWithLog(comment, {
      moderatorId: modId,
      action: actionName,
      targetType: 'comment',
      targetId: comment._id,
      targetTitle: comment.content.slice(0, 100),
      reason: data.reason,
      note: data.note,
    })

    try {
      emitToModerators('moderation:queue_updated', { type: 'comment', action })
    } catch (err) {
      logger.warn('Failed to emit moderation:queue_updated for comment:', err)
    }

    return comment
  },

  // ─── 5. Reports Management ──────────────────────────────────────────────────

  async createReport(reporterId: string, input: CreateReportDto) {
    const { targetType, targetId, reason, description, evidenceUrls } = input

    // Prevent self-reporting
    let targetOwnerId: string | null = null

    switch (targetType) {
      case 'story': {
        const s = await storyRepository.findById(targetId)
        if (!s) throw AppError.notFound('Truyện không tồn tại')
        targetOwnerId = resourceId(s.authorId)
        break
      }
      case 'chapter': {
        const c = await chapterRepository.findByIdWithStoryAuthor(targetId)
        if (!c) throw AppError.notFound('Chương không tồn tại')
        const storyObj = c.storyId as { authorId?: Types.ObjectId | string } | undefined
        targetOwnerId = storyObj?.authorId ? storyObj.authorId.toString() : null
        break
      }
      case 'comment': {
        const cm = await commentRepository.findById(targetId)
        if (!cm || cm.isDeleted) throw AppError.notFound('Bình luận không tồn tại')
        targetOwnerId = cm.userId.toString()
        break
      }
      case 'user': {
        const u = await userRepository.findById(targetId)
        if (!u) throw AppError.notFound('Người dùng không tồn tại')
        targetOwnerId = u._id.toString()
        break
      }
    }

    if (targetOwnerId === reporterId) {
      throw AppError.badRequest('Bạn không thể tự báo cáo nội dung của chính mình')
    }

    const createdReport = await reportRepository.create({
      reporterId,
      targetType,
      targetId,
      reason,
      description,
      evidenceUrls,
    })

    try {
      emitToModerators('moderation:new_report', {
        reportId: createdReport._id ? createdReport._id.toString() : '',
        targetType: createdReport.targetType || targetType,
        targetId: createdReport.targetId ? createdReport.targetId.toString() : String(targetId),
        reason: createdReport.reason || reason,
        createdAt: createdReport.createdAt || new Date(),
      })
      emitToModerators('moderation:queue_updated', {
        type: 'report',
        action: 'created',
      })
    } catch (err) {
      logger.warn('Failed to emit moderation socket event for new report:', err)
    }

    return createdReport
  },

  async getReports(query: ReportsQueryDto) {
    return reportRepository.findWithCursor(query)
  },

  async getReportDetail(reportId: string) {
    const report = await reportRepository.findById(reportId)
    if (!report) {
      throw AppError.notFound('Báo cáo không tồn tại')
    }

    // Fetch Target snapshot
    let targetData: IStory | IChapter | CommentDocument | IUser | null = null
    switch (report.targetType) {
      case 'story':
        targetData = await storyRepository.findByIdForReportTarget(report.targetId.toString())
        break
      case 'chapter':
        targetData = await chapterRepository.findByIdForReportTarget(report.targetId)
        break
      case 'comment':
        targetData = await commentRepository.findByIdForReportTarget(report.targetId)
        break
      case 'user':
        targetData = await userRepository.findByIdSafe(report.targetId.toString())
        break
    }

    // Target history: other reports on this target
    const [targetOtherReportsCount, reporterTotalReportsCount, targetAuditLogs] =
      await Promise.all([
        reportRepository.countByTarget(report.targetType, report.targetId),
        reportRepository.countByReporter(report.reporterId._id || report.reporterId),
        moderationLogRepository.findByTarget(report.targetType, report.targetId, 10),
      ])

    return {
      report,
      targetData,
      stats: {
        targetOtherReportsCount,
        reporterTotalReportsCount,
      },
      targetAuditLogs,
    }
  },

  async actionReport(modId: string, reportId: string, input: ReportActionDto) {
    const report = await reportRepository.findById(reportId)
    if (!report) {
      throw AppError.notFound('Báo cáo không tồn tại')
    }

    const { action, note, notifyUser } = input

    // Take action on target based on action type
    let targetOwnerUserId: string | null = null
    let targetDocument: IStory | IChapter | CommentDocument | undefined
    let targetName = 'nội dung'

    if (report.targetType === 'user' && !['dismiss', 'warn_user'].includes(action)) throw AppError.badRequest('Hành động không phù hợp với tài khoản')
    if (action === 'request_revision' && !['story', 'chapter'].includes(report.targetType)) throw AppError.badRequest('Chỉ yêu cầu sửa truyện/chương')
    if (action === 'hide' || action === 'remove' || action === 'request_revision') {
      if (report.targetType === 'story') {
        const s = await storyRepository.findById(report.targetId.toString())
        if (s) {
          s.moderationStatus = action === 'request_revision' ? 'pending' : action === 'hide' ? 'hidden' : 'removed'
          targetDocument = s
          targetOwnerUserId = s.authorId ? resourceId(s.authorId) : null
          targetName = `Truyện "${s.title}"`
        }
      } else if (report.targetType === 'chapter') {
        const c = await chapterRepository.findByIdWithStoryAuthor(report.targetId)
        if (c) {
          c.moderationStatus = action === 'request_revision' ? 'pending' : 'hidden'
          targetDocument = c
          const storyObj = c.storyId as { authorId?: Types.ObjectId | string } | undefined
          targetOwnerUserId = storyObj?.authorId ? storyObj.authorId.toString() : null
          targetName = `Chương "${c.title}"`
        }
      } else if (report.targetType === 'comment') {
        const cm = await commentRepository.findById(report.targetId)
        if (cm) {
          if (action === 'hide') cm.isHidden = true
          if (action === 'remove') cm.isDeleted = true
          targetDocument = cm
          targetOwnerUserId = cm.userId.toString()
          targetName = 'Bình luận của bạn'
        }
      }
    } else if (action === 'warn_user') {
      // Find owner of target
      if (report.targetType === 'user') {
        targetOwnerUserId = report.targetId.toString()
      } else if (report.targetType === 'story') {
        const s = await storyRepository.findById(report.targetId.toString())
        if (s) targetOwnerUserId = resourceId(s.authorId)
      } else if (report.targetType === 'comment') {
        const cm = await commentRepository.findById(report.targetId)
        if (cm) targetOwnerUserId = cm.userId.toString()
      }

    }

    // Resolve report record
    const updatedReport = await reportRepository.resolveReport(reportId, {
      action,
      moderatorId: modId,
      note,
    }, targetDocument)

    if (targetOwnerUserId && notifyUser) {
      await notifyAfterCommit(targetOwnerUserId, { type: 'system', title: 'Kết quả xử lý báo cáo', message: note || 'Nội dung liên quan đã được kiểm duyệt.' })
    }

    try {
      emitToModerators('moderation:queue_updated', { type: 'report', reportId, action })
    } catch (err) {
      logger.warn('Failed to emit moderation:queue_updated for report action:', err)
    }

    return updatedReport
  },

  async addReportNote(modId: string, reportId: string, note: string) {
    const updated = await reportRepository.addNote(reportId, modId, note)
    if (!updated) {
      throw AppError.notFound('Báo cáo không tồn tại')
    }

    return updated
  },

  async assignReport(modId: string, reportId: string, targetModId?: string) {
    const assignedModId = targetModId || modId
    const moderator = await userRepository.findById(assignedModId)
    if (!moderator || isAccountLocked(moderator) || !['moderator', 'admin'].includes(moderator.role)) throw AppError.badRequest('Người nhận phải là kiểm duyệt viên đang hoạt động', 'INVALID_ASSIGNEE')
    const updated = await reportRepository.assignReport(reportId, assignedModId, modId)
    if (!updated) {
      throw AppError.notFound('Báo cáo không tồn tại')
    }

    return updated
  },

  // ─── 6. Moderation History / Audit Log ──────────────────────────────────────

  async getModerationHistory(query: HistoryQueryDto) {
    let fromDate: Date | undefined
    if (query.range === '24h') {
      fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
    } else if (query.range === '7d') {
      fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    } else if (query.range === '30d') {
      fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }

    return moderationLogRepository.findWithCursor({
      action: query.action,
      targetType: query.targetType,
      moderatorId: query.moderatorId,
      fromDate,
      cursor: query.cursor,
      limit: query.limit,
    })
  },
}
