import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'
import { moderationService } from '../moderation.service.js'
import { storyRepository } from '../../../repositories/story.repository.js'
import { chapterRepository } from '../../../repositories/chapter.repository.js'
import { commentRepository } from '../../../repositories/comment.repository.js'
import { userRepository } from '../../../repositories/user.repository.js'
import { reportRepository } from '../../../repositories/report.repository.js'
import { moderationLogRepository } from '../../../repositories/moderation-log.repository.js'
import { notificationsService } from '../../notifications/notifications.service.js'
import { isPublicChapter } from '../../../common/contentVisibility.js'
import { emitToModerators } from '../../../config/socket.js'

vi.mock('../../../repositories/story.repository.js')
vi.mock('../../../repositories/chapter.repository.js')
vi.mock('../../../repositories/comment.repository.js')
vi.mock('../../../repositories/user.repository.js')
vi.mock('../../../repositories/report.repository.js')
vi.mock('../../../repositories/moderation-log.repository.js')
vi.mock('../../notifications/notifications.service.js')
vi.mock('../../../config/socket.js', () => ({
  emitToModerators: vi.fn(),
  emitToUser: vi.fn(),
  emitToRoom: vi.fn(),
}))

describe('Moderation Service', () => {
  const modId = new Types.ObjectId().toString()
  const authorId = new Types.ObjectId().toString()
  const storyId = new Types.ObjectId().toString()
  const chapterId = new Types.ObjectId().toString()
  const commentId = new Types.ObjectId().toString()
  const reportId = new Types.ObjectId().toString()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(notificationsService.notifyNewChapter).mockResolvedValue(0)
  })

  describe('getQueueSummary', () => {
    it('aggregates counts from stories, chapters, comments, and reports', async () => {
      vi.mocked(storyRepository.countPendingModeration).mockResolvedValue(5)
      vi.mocked(chapterRepository.countPendingModeration).mockResolvedValue(8)
      vi.mocked(commentRepository.countSpamQueue).mockResolvedValue(3)
      vi.mocked(reportRepository.countPending).mockResolvedValue(4)

      const summary = await moderationService.getQueueSummary()
      expect(summary).toEqual({
        pendingStories: 5,
        pendingChapters: 8,
        spamComments: 3,
        pendingReports: 4,
        totalPending: 20,
      })
    })
  })

  describe('moderateStory', () => {
    it('approves story, updates moderationStatus, logs audit, and sends notification', async () => {
      const mockStory = {
        _id: new Types.ObjectId(storyId),
        title: 'Vạn Cổ Chí Tôn',
        authorId: {
          _id: new Types.ObjectId(authorId),
          displayName: 'Tác giả A',
        },
        moderationStatus: 'pending',
        save: vi.fn().mockResolvedValue(true),
      }

      vi.mocked(storyRepository.findByIdForModeration).mockResolvedValue(mockStory as any)
      vi.mocked(moderationLogRepository.log).mockResolvedValue({} as any)
      vi.mocked(notificationsService.createAndEmitNotification).mockResolvedValue({} as any)

      const result = await moderationService.moderateStory(modId, storyId, 'approve', {
        reason: 'Nội dung đạt chuẩn',
        notifyUser: true,
      })

      expect(mockStory.moderationStatus).toBe('approved')
      expect(moderationLogRepository.saveWithLog).toHaveBeenCalled()
      expect(moderationLogRepository.saveWithLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          moderatorId: modId,
          action: 'approve_story',
          targetType: 'story',
          targetTitle: 'Vạn Cổ Chí Tôn',
        })
      )
      expect(notificationsService.createAndEmitNotification).toHaveBeenCalledWith(
        authorId,
        expect.objectContaining({
          type: 'system',
          title: expect.stringContaining('đã được duyệt'),
        })
      )
      expect(result).toBe(mockStory)
    })

    it('throws error when story not found', async () => {
      vi.mocked(storyRepository.findByIdForModeration).mockResolvedValue(null)

      await expect(
        moderationService.moderateStory(modId, storyId, 'approve', { notifyUser: false })
      ).rejects.toThrow('Truyện không tồn tại')
    })
  })

  describe('moderateChapter', () => {
    it.each(['draft', 'scheduled', 'published'] as const)('publishes only approved chapters requested for publication (%s)', async status => {
      const story = { _id: new Types.ObjectId(storyId), title: 'Truyện', slug: 'truyen', authorId, moderationStatus: 'approved' }
      const chapter = { _id: new Types.ObjectId(chapterId), title: 'Chương mới', status, moderationStatus: 'pending', storyId: story }
      vi.mocked(chapterRepository.findByIdForModeration).mockResolvedValue(chapter as any)
      vi.mocked(chapterRepository.countPublishedByStoryId).mockResolvedValue(status === 'published' ? 1 : 0)
      vi.mocked(storyRepository.findById).mockResolvedValue(story as any)
      expect(isPublicChapter(chapter)).toBe(false)

      await moderationService.moderateChapter(modId, chapterId, 'approve', { notifyUser: false })

      expect(chapter.moderationStatus).toBe('approved')
      expect(isPublicChapter(chapter)).toBe(status === 'published')
      expect(moderationLogRepository.saveWithLog).toHaveBeenCalledWith(chapter, expect.objectContaining({ targetType: 'chapter', action: 'approve_chapter' }))
      expect(storyRepository.updateById).not.toHaveBeenCalled()
      expect(notificationsService.notifyNewChapter).toHaveBeenCalledTimes(status === 'published' ? 1 : 0)
    })

    it('approves chapter and writes to audit trail', async () => {
      const mockChapter = {
        _id: new Types.ObjectId(chapterId),
        title: 'Chương 1: Mở Đầu',
        storyId: {
          _id: new Types.ObjectId(storyId),
          title: 'Vạn Cổ Chí Tôn',
          authorId: new Types.ObjectId(authorId),
        },
        moderationStatus: 'pending',
        save: vi.fn().mockResolvedValue(true),
      }

      vi.mocked(chapterRepository.findByIdForModeration).mockResolvedValue(mockChapter as any)
      vi.mocked(moderationLogRepository.log).mockResolvedValue({} as any)
      vi.mocked(notificationsService.createAndEmitNotification).mockResolvedValue({} as any)

      await moderationService.moderateChapter(modId, chapterId, 'approve', { notifyUser: true })

      expect(mockChapter.moderationStatus).toBe('approved')
      expect(moderationLogRepository.saveWithLog).toHaveBeenCalled()
      expect(moderationLogRepository.saveWithLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'approve_chapter',
          targetType: 'chapter',
        })
      )
    })
  })

  describe('moderateComment', () => {
    it('resets spam score and unlocks comment when approved', async () => {
      const mockComment = {
        _id: new Types.ObjectId(commentId),
        content: 'Bình luận nghi vấn spam',
        spamScore: 80,
        isLocked: true,
        isDeleted: false,
        save: vi.fn().mockResolvedValue(true),
      }

      vi.mocked(commentRepository.findByIdForModeration).mockResolvedValue(mockComment as any)
      vi.mocked(moderationLogRepository.log).mockResolvedValue({} as any)

      await moderationService.moderateComment(modId, commentId, 'approve', { notifyUser: false })

      expect(mockComment.spamScore).toBe(0)
      expect(mockComment.isLocked).toBe(false)
      expect(moderationLogRepository.saveWithLog).toHaveBeenCalled()
      expect(moderationLogRepository.saveWithLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'approve_comment',
          targetType: 'comment',
        })
      )
    })
  })

  describe('createReport', () => {
    const reporterId = new Types.ObjectId().toString()
    const otherUserId = new Types.ObjectId().toString()

    it('creates report for a story', async () => {
      vi.mocked(storyRepository.findById).mockResolvedValue({
        _id: new Types.ObjectId(storyId),
        authorId: new Types.ObjectId(otherUserId),
      } as any)

      vi.mocked(reportRepository.create).mockResolvedValue({
        _id: new Types.ObjectId(reportId),
        targetType: 'story',
        targetId: new Types.ObjectId(storyId),
        reason: 'Vi phạm bản quyền',
        status: 'pending',
        createdAt: new Date(),
      } as any)

      const result = await moderationService.createReport(reporterId, {
        targetType: 'story',
        targetId: storyId,
        reason: 'Vi phạm bản quyền',
      })

      expect(reportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reporterId,
          targetType: 'story',
          targetId: storyId,
          reason: 'Vi phạm bản quyền',
        })
      )
      expect(emitToModerators).toHaveBeenCalledWith(
        'moderation:new_report',
        expect.objectContaining({
          reportId,
          targetType: 'story',
          targetId: storyId,
          reason: 'Vi phạm bản quyền',
        })
      )
      expect(result).toBeDefined()
    })

    it('prevents user from self-reporting their own story', async () => {
      vi.mocked(storyRepository.findById).mockResolvedValue({
        _id: new Types.ObjectId(storyId),
        authorId: new Types.ObjectId(reporterId), // same as reporter!
      } as any)

      await expect(
        moderationService.createReport(reporterId, {
          targetType: 'story',
          targetId: storyId,
          reason: 'Vi phạm bản quyền',
        })
      ).rejects.toThrow('Bạn không thể tự báo cáo nội dung của chính mình')
    })
  })

  describe('actionReport', () => {
    it('hides target story and resolves report', async () => {
      const mockReport = {
        _id: new Types.ObjectId(reportId),
        targetType: 'story',
        targetId: new Types.ObjectId(storyId),
        reason: 'Nội dung phản cảm',
      }

      vi.mocked(reportRepository.findById).mockResolvedValue(mockReport as any)

      const mockStory = {
        _id: new Types.ObjectId(storyId),
        title: 'Truyện Bị Báo Cáo',
        authorId: new Types.ObjectId(authorId),
        moderationStatus: 'approved',
        save: vi.fn().mockResolvedValue(true),
      }
      vi.mocked(storyRepository.findById).mockResolvedValue(mockStory as any)
      vi.mocked(reportRepository.resolveReport).mockResolvedValue({ ...mockReport, status: 'resolved' } as any)
      vi.mocked(moderationLogRepository.log).mockResolvedValue({} as any)

      const result = await moderationService.actionReport(modId, reportId, {
        action: 'hide',
        note: 'Ẩn truyện theo báo cáo',
        notifyUser: false,
      })

      expect(mockStory.moderationStatus).toBe('hidden')
      expect(mockStory.save).not.toHaveBeenCalled()
      expect(reportRepository.resolveReport).toHaveBeenCalledWith(
        reportId,
        expect.objectContaining({ action: 'hide', moderatorId: modId }),
        mockStory
      )
      expect(result?.status).toBe('resolved')
    })

    it('dismisses report without altering target', async () => {
      const mockReport = {
        _id: new Types.ObjectId(reportId),
        targetType: 'story',
        targetId: new Types.ObjectId(storyId),
        reason: 'Báo cáo sai',
      }

      vi.mocked(reportRepository.findById).mockResolvedValue(mockReport as any)
      vi.mocked(reportRepository.resolveReport).mockResolvedValue({ ...mockReport, status: 'dismissed' } as any)
      vi.mocked(moderationLogRepository.log).mockResolvedValue({} as any)

      const result = await moderationService.actionReport(modId, reportId, {
        action: 'dismiss',
        note: 'Báo cáo không có căn cứ',
        notifyUser: false,
      })

      expect(storyRepository.findById).not.toHaveBeenCalled()
      expect(reportRepository.resolveReport).toHaveBeenCalledWith(
        reportId,
        expect.objectContaining({ action: 'dismiss' }),
        undefined
      )
      expect(result?.status).toBe('dismissed')
    })
  })

  describe('getModerationHistory', () => {
    it('queries moderation audit logs with time range filter', async () => {
      vi.mocked(moderationLogRepository.findWithCursor).mockResolvedValue({
        logs: [],
        meta: { limit: 20, nextCursor: null, hasMore: false },
      })

      const res = await moderationService.getModerationHistory({
        range: '7d',
        targetType: 'story',
        limit: 20,
      })

      expect(moderationLogRepository.findWithCursor).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: 'story',
          fromDate: expect.any(Date),
        })
      )
      expect(res.logs).toEqual([])
    })
  })
})

