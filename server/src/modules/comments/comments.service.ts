import { commentRepository } from '../../repositories/comment.repository.js'
import { storyRepository } from '../../repositories/story.repository.js'
import { chapterRepository } from '../../repositories/chapter.repository.js'
import { AppError } from '../../common/AppError.js'
import { calculateSpamScore, isSpam } from '../../common/spamDetection.js'
import { logger } from '../../common/logger.js'
import { notificationsService } from '../notifications/notifications.service.js'
import { Types } from 'mongoose'
import type { CreateCommentDto, QueryCommentsDto, QueryRepliesDto } from './comments.validation.js'
import type { PopulatedComment } from '../../models/Comment.model.js'
import { resourceId, isPublicStory, isPublicChapter } from '../../common/contentVisibility.js'

export const commentsService = {
  async createComment(userId: string, dto: CreateCommentDto): Promise<PopulatedComment> {
    const { storyId, chapterId, parentId, content } = dto

    // Validate story exists and is visible
    if (!Types.ObjectId.isValid(storyId)) {
      throw new AppError(400, 'Story ID không hợp lệ')
    }
    const story = await storyRepository.findById(storyId)
    if (!story || !isPublicStory(story)) {
      throw new AppError(404, 'Truyện không tồn tại')
    }

    // Validate chapter if provided
    let chapterDoc: any = null
    if (chapterId) {
      if (!Types.ObjectId.isValid(chapterId)) {
        throw new AppError(400, 'Chapter ID không hợp lệ')
      }
      const chapter = await chapterRepository.findById(chapterId)
      if (!chapter || !isPublicChapter(chapter)) {
        throw new AppError(404, 'Chương không tồn tại hoặc chưa được xuất bản')
      }
      const chapterStoryId =
        (chapter.storyId as any)?._id ? (chapter.storyId as any)._id.toString() : chapter.storyId.toString()
      if (chapterStoryId !== storyId) {
        throw new AppError(400, 'Chương không thuộc truyện này')
      }
      chapterDoc = chapter
    }

    // Spam detection
    const spamScore = calculateSpamScore(content)
    if (isSpam(content)) {
      throw new AppError(422, 'Bình luận của bạn bị phát hiện là spam. Vui lòng thử lại với nội dung khác.')
    }

    // Handle parent comment for replies
    let effectiveParentId: Types.ObjectId | null = null
    let replyToUserId: Types.ObjectId | null = null

    if (parentId) {
      if (!Types.ObjectId.isValid(parentId)) {
        throw new AppError(400, 'Parent Comment ID không hợp lệ')
      }
      const parentComment = await commentRepository.findById(parentId)
      if (!parentComment || parentComment.isDeleted || parentComment.isHidden) {
        throw new AppError(404, 'Bình luận gốc không tồn tại hoặc đã bị xóa')
      }
      if (parentComment.isLocked) {
        throw new AppError(403, 'Bình luận này đã bị khóa, không thể phản hồi')
      }

      const assertContext = (comment: typeof parentComment) => {
        if (resourceId(comment.storyId) !== storyId || resourceId(comment.chapterId) !== (chapterId || '')) {
          throw AppError.badRequest('Bình luận không thuộc cùng truyện/chương', 'COMMENT_CONTEXT_MISMATCH')
        }
        if (comment.isDeleted || comment.isHidden || comment.isLocked) throw AppError.forbidden('Bình luận gốc đã bị khóa hoặc xóa')
      }
      assertContext(parentComment)

      // Flatten structure: If parent is already a reply, attach to root comment
      if (parentComment.parentId) {
        const root = await commentRepository.findById(resourceId(parentComment.parentId))
        if (!root || root.parentId) throw AppError.notFound('Bình luận gốc không tồn tại')
        assertContext(root)
        effectiveParentId = parentComment.parentId as Types.ObjectId
      } else {
        effectiveParentId = parentComment._id
      }
      replyToUserId = parentComment.userId
    }

    const comment = await commentRepository.create({
      storyId,
      chapterId: chapterId || null,
      userId,
      parentId: effectiveParentId,
      replyToUserId,
      content,
      spamScore,
    })

    const result = await commentRepository.findPopulatedById(comment._id)
    if (!result) {
      throw new AppError(500, 'Lỗi khi tải bình luận vừa tạo')
    }

    // Trigger notification if replying to someone else's comment
    if (effectiveParentId && replyToUserId && replyToUserId.toString() !== userId) {
      const replyUser = result.userId as any
      notificationsService.notifyCommentReply(
        { userId: replyToUserId },
        { id: userId, displayName: replyUser?.displayName, username: replyUser?.username },
        content,
        { slug: story.slug, title: story.title },
        chapterDoc ? { slug: chapterDoc.slug, title: chapterDoc.title } : undefined
      ).catch((err) => {
        logger.warn('Failed to send comment reply notification:', err)
      })
    }

    return result
  },

  async getComments(
    dto: QueryCommentsDto,
    requestingUserId?: string
  ): Promise<{ items: PopulatedComment[]; hasMore: boolean; nextCursor: string | null }> {
    const { storyId, chapterId, sort, cursor, limit } = dto

    if (!Types.ObjectId.isValid(storyId)) {
      throw new AppError(400, 'Story ID không hợp lệ')
    }

    const story = await storyRepository.findById(storyId)
    if (!isPublicStory(story)) throw AppError.notFound('Truyện không tồn tại')
    if (chapterId) {
      const chapter = await chapterRepository.findById(chapterId)
      if (!isPublicChapter(chapter) || resourceId(chapter?.storyId) !== storyId) throw AppError.notFound('Chương không tồn tại')
    }
    const result = await commentRepository.findManyPaginated({
      storyId,
      chapterId: chapterId ?? undefined,
      sort: sort as 'newest' | 'top',
      cursor: cursor ?? null,
      limit,
    })

    const items: PopulatedComment[] = result.items.map((c) => ({
      ...c,
      likedByMe: requestingUserId
        ? (c.likedUserIds ?? []).some((uid) => uid.toString() === requestingUserId)
        : false,
      likedUserIds: undefined,
      previewReplies: (c.previewReplies || []).map((r) => ({
        ...r,
        likedByMe: requestingUserId
          ? (r.likedUserIds ?? []).some((uid) => uid.toString() === requestingUserId)
          : false,
        likedUserIds: undefined,
      })),
    }))

    return { items, hasMore: result.hasMore, nextCursor: result.nextCursor }
  },

  async getReplies(
    parentId: string,
    dto: QueryRepliesDto,
    requestingUserId?: string
  ): Promise<{ items: PopulatedComment[]; hasMore: boolean; nextCursor: string | null }> {
    if (!Types.ObjectId.isValid(parentId)) {
      throw new AppError(400, 'Comment ID không hợp lệ')
    }

    const parent = await commentRepository.findById(parentId)
    if (!parent || parent.isDeleted || parent.isHidden) throw AppError.notFound('Bình luận không tồn tại')
    const story = await storyRepository.findById(resourceId(parent.storyId))
    if (!isPublicStory(story)) throw AppError.notFound('Truyện không tồn tại')
    if (parent.chapterId && !isPublicChapter(await chapterRepository.findById(resourceId(parent.chapterId)))) throw AppError.notFound('Chương không tồn tại')
    const result = await commentRepository.findRepliesPaginated({
      parentId,
      cursor: dto.cursor ?? null,
      limit: dto.limit,
    })

    const items: PopulatedComment[] = result.items.map((r) => ({
      ...r,
      likedByMe: requestingUserId
        ? (r.likedUserIds ?? []).some((uid) => uid.toString() === requestingUserId)
        : false,
      likedUserIds: undefined,
    }))

    return { items, hasMore: result.hasMore, nextCursor: result.nextCursor }
  },

  async updateComment(commentId: string, userId: string, content: string) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new AppError(400, 'Comment ID không hợp lệ')
    }
    if (isSpam(content)) {
      throw new AppError(422, 'Nội dung bị phát hiện là spam')
    }

    const updated = await commentRepository.update(commentId, userId, content)
    if (!updated) {
      throw new AppError(404, 'Không tìm thấy bình luận hoặc bạn không có quyền chỉnh sửa')
    }
    return updated
  },

  async deleteComment(
    commentId: string,
    requestingUserId: string,
    requestingUserRole: string,
    authorStatus?: string
  ) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new AppError(400, 'Comment ID không hợp lệ')
    }

    const comment = await commentRepository.findById(commentId)
    if (!comment || comment.isDeleted) {
      throw new AppError(404, 'Bình luận không tồn tại')
    }

    const isOwner = comment.userId.toString() === requestingUserId
    const isMod = ['moderator', 'admin'].includes(requestingUserRole)

    let isStoryAuthor = false
    const story = await storyRepository.findById(comment.storyId.toString())
    if (story && story.authorId) {
      const authorIdStr = (story.authorId as any)?._id
        ? (story.authorId as any)._id.toString()
        : story.authorId.toString()
      isStoryAuthor = requestingUserRole === 'author' && authorStatus === 'approved' && authorIdStr === requestingUserId
    }

    if (!isOwner && !isMod && !isStoryAuthor) {
      throw new AppError(403, 'Bạn không có quyền xóa bình luận này')
    }

    return commentRepository.softDelete(commentId, requestingUserId)
  },

  async toggleLike(
    commentId: string,
    userId: string,
    likerUser?: { id: string; displayName?: string; username?: string }
  ) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new AppError(400, 'Comment ID không hợp lệ')
    }

    // Guard: fetch comment first to check ownership
    const comment = await commentRepository.findById(commentId)
    if (!comment || comment.isDeleted || comment.isHidden) {
      throw new AppError(404, 'Bình luận không tồn tại')
    }
    if (comment.userId.toString() === userId) {
      throw new AppError(403, 'Bạn không thể thích bình luận của chính mình')
    }

    const updated = await commentRepository.toggleLike(commentId, userId)
    if (!updated) {
      throw new AppError(404, 'Bình luận không tồn tại')
    }

    // Trigger notification if user liked another user's comment
    const isLiked = (updated.likedUserIds ?? []).some((uid) => uid.toString() === userId)
    if (isLiked && likerUser) {
      const commentAuthorId = updated.userId.toString()
      if (commentAuthorId !== userId) {
        Promise.resolve()
          .then(async () => {
            const story = await storyRepository.findById(updated.storyId.toString())
            if (!story) return

            let chapterDoc: any = null
            if (updated.chapterId) {
              chapterDoc = await chapterRepository.findById(updated.chapterId.toString())
            }

            await notificationsService.notifyCommentLike(
              { userId: updated.userId, content: updated.content },
              likerUser,
              { slug: story.slug, title: story.title },
              chapterDoc ? { slug: chapterDoc.slug, title: chapterDoc.title } : undefined
            )
          })
          .catch((err) => {
            logger.warn('Failed to send comment like notification:', err)
          })
      }
    }

    return { likeCount: updated.likeCount }
  },

  async toggleLock(
    commentId: string,
    requestingUserId: string,
    requestingUserRole: string,
    authorStatus?: string
  ) {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new AppError(400, 'Comment ID không hợp lệ')
    }

    const comment = await commentRepository.findById(commentId)
    if (!comment || comment.isDeleted) {
      throw new AppError(404, 'Bình luận không tồn tại')
    }

    const isMod = ['moderator', 'admin'].includes(requestingUserRole)

    let isStoryAuthor = false
    const story = await storyRepository.findById(comment.storyId.toString())
    if (story && story.authorId) {
      const authorIdStr = (story.authorId as any)?._id
        ? (story.authorId as any)._id.toString()
        : story.authorId.toString()
      isStoryAuthor = requestingUserRole === 'author' && authorStatus === 'approved' && authorIdStr === requestingUserId
    }

    if (!isMod && !isStoryAuthor) {
      throw new AppError(403, 'Bạn không có quyền khoá bình luận này')
    }

    const updated = await commentRepository.toggleLock(commentId)
    if (!updated) throw new AppError(404, 'Bình luận không tồn tại')
    return { isLocked: updated.isLocked }
  },
}
