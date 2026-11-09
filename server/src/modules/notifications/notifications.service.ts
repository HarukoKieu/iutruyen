import { storyRepository } from '../../repositories/story.repository.js'
import { chapterRepository } from '../../repositories/chapter.repository.js'
import { isPublicStory, isPublicChapter, resourceId } from '../../common/contentVisibility.js'
import { notificationRepository, CreateNotificationInput, FindNotificationsOptions } from '../../repositories/notification.repository.js'
import { followRepository } from '../../repositories/follow.repository.js'
import { emitToUser } from '../../config/socket.js'
import { logger } from '../../common/logger.js'
import { AppError } from '../../common/AppError.js'
import { Types } from 'mongoose'
import type { QueryNotificationsDto } from './notifications.validation.js'
import type { INotification } from '../../models/Notification.model.js'

export const notificationsService = {
  async getUserNotifications(userId: string, query: QueryNotificationsDto) {
    const options: FindNotificationsOptions = {
      isRead: query.isRead,
      type: query.type,
      cursor: query.cursor,
      limit: query.limit,
    }

    const [result, unreadCount] = await Promise.all([
      notificationRepository.findByUserId(userId, options),
      notificationRepository.countUnread(userId),
    ])

    return {
      notifications: result.notifications,
      nextCursor: result.nextCursor,
      unreadCount,
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    return notificationRepository.countUnread(userId)
  },

  async markAsRead(userId: string, notificationId: string): Promise<INotification> {
    const updated = await notificationRepository.markAsRead(notificationId, userId)
    if (!updated) {
      throw AppError.notFound('Thông báo không tồn tại hoặc không thuộc về bạn', 'NOTIFICATION_NOT_FOUND')
    }
    return updated
  },

  async markAllAsRead(userId: string): Promise<number> {
    return notificationRepository.markAllAsRead(userId)
  },

  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    const deleted = await notificationRepository.delete(notificationId, userId)
    if (!deleted) {
      throw AppError.notFound('Thông báo không tồn tại hoặc không thuộc về bạn', 'NOTIFICATION_NOT_FOUND')
    }
    return true
  },

  /**
   * Helper: Create single notification and emit to user via Socket.IO
   */
  async createAndEmitNotification(
    userId: string | Types.ObjectId,
    data: Omit<CreateNotificationInput, 'userId'>
  ): Promise<INotification> {
    const notification = await notificationRepository.create({
      ...data,
      userId,
    })

    try {
      const uIdStr = userId.toString()
      await emitToUser(uIdStr, 'notification:new', notification)
    } catch (err) {
      logger.warn(`Failed to emit socket notification to ${userId}:`, err)
    }

    return notification
  },


  /**
   * Trigger: Notify all followers when a story has a new published chapter
   */
  async notifyNewChapter(
    story: { _id: Types.ObjectId | string; title: string; slug: string; authorId: Types.ObjectId | string },
    chapter: { _id: Types.ObjectId | string; title: string; slug: string; order: number }
  ): Promise<number> {
    try {
      const currentStory = await storyRepository.findById(String(story._id))
      const currentChapter = await chapterRepository.findById(String(chapter._id))
      if (!isPublicStory(currentStory) || !isPublicChapter(currentChapter)) return 0
      let total = 0
      let afterId: string | undefined
      while (true) {
      const followers = await followRepository.findFollowersByStoryId(story._id, afterId, 200)
      if (!followers?.length) break
      afterId = resourceId(followers[followers.length - 1])
      const authorIdStr = (typeof story.authorId === 'object' && (story.authorId as any)._id)
        ? (story.authorId as any)._id.toString()
        : story.authorId.toString()

      // Exclude author if they follow their own story
      const targetFollowers = followers.filter(
        (f) => f.userId.toString() !== authorIdStr
      )

      if (targetFollowers.length === 0) { if (followers.length < 200) break; continue }

      const notifInputs: CreateNotificationInput[] = targetFollowers.map((f) => ({
        userId: f.userId,
        type: 'new_chapter',
        title: `Chương mới: ${story.title}`,
        message: `Tác phẩm "${story.title}" vừa đăng tải "${chapter.title}". Đọc ngay!`,
        link: `/stories/${story.slug}/chapters/${chapter.slug}`,
        meta: {
          storyId: story._id.toString(),
          chapterId: chapter._id.toString(),
          chapterOrder: chapter.order,
        },
      }))

      const visible = await storyRepository.findById(String(story._id))
      const visibleChapter = await chapterRepository.findById(String(chapter._id))
      if (!isPublicStory(visible) || !isPublicChapter(visibleChapter)) break
      const createdNotifications = await notificationRepository.createMany(notifInputs)

      // Emit realtime socket event to each online follower
      for (const notif of createdNotifications) {
        try {
          const uIdStr = notif.userId.toString()
          await emitToUser(uIdStr, 'notification:new', notif)
        } catch (err) {
          logger.debug(`Could not emit realtime notification to ${notif.userId}:`, err)
        }
      }

      total += createdNotifications.length
      if (followers.length < 200) break
      }
      return total
    } catch (error) {
      logger.error('Error in notifyNewChapter:', error)
      return 0
    }
  },

  /**
   * Trigger: Notify original comment author when someone replies
   */
  async notifyCommentReply(
    parentComment: { userId: Types.ObjectId | string },
    replyUser: { id: string; displayName?: string; username?: string },
    replyContent: string,
    story: { slug: string; title: string },
    chapter?: { slug: string; title: string }
  ): Promise<INotification | null> {
    try {
      const parentUserIdStr = parentComment.userId.toString()
      // Do not notify if replying to oneself
      if (parentUserIdStr === replyUser.id) return null

      const link = chapter
        ? `/stories/${story.slug}/chapters/${chapter.slug}`
        : `/stories/${story.slug}`

      const senderName = replyUser.displayName || replyUser.username || 'Một độc giả'
      const snippet =
        replyContent.length > 80 ? `${replyContent.slice(0, 80)}...` : replyContent

      return await this.createAndEmitNotification(parentUserIdStr, {
        type: 'comment_reply',
        title: `${senderName} đã trả lời bình luận của bạn`,
        message: `"${snippet}" trong tác phẩm "${story.title}"`,
        link,
        meta: {
          senderId: replyUser.id,
          storySlug: story.slug,
          chapterSlug: chapter?.slug,
        },
      })
    } catch (error) {
      logger.error('Error in notifyCommentReply:', error)
      return null
    }
  },

  /**
   * Trigger: Notify story author when someone follows their story
   */
  async notifyNewFollow(
    story: { _id: Types.ObjectId | string; title: string; slug: string; authorId: Types.ObjectId | string },
    followerUser: { id: string; displayName?: string; username?: string }
  ): Promise<INotification | null> {
    try {
      const authorIdStr = (typeof story.authorId === 'object' && (story.authorId as any)._id)
        ? (story.authorId as any)._id.toString()
        : story.authorId.toString()

      // Do not notify if author follows their own story
      if (authorIdStr === followerUser.id) return null

      const followerName = followerUser.displayName || followerUser.username || 'Một độc giả'

      return await this.createAndEmitNotification(authorIdStr, {
        type: 'new_follow',
        title: 'Có người theo dõi mới',
        message: `${followerName} đã thêm tác phẩm "${story.title}" vào tủ sách theo dõi.`,
        link: `/stories/${story.slug}`,
        meta: {
          followerId: followerUser.id,
          storyId: story._id.toString(),
        },
      })
    } catch (error) {
      logger.error('Error in notifyNewFollow:', error)
      return null
    }
  },

  /**
   * Trigger: Notify comment author when someone likes their comment
   */
  async notifyCommentLike(
    targetComment: { userId: Types.ObjectId | string; content: string },
    likerUser: { id: string; displayName?: string; username?: string },
    story: { slug: string; title: string },
    chapter?: { slug: string; title: string }
  ): Promise<INotification | null> {
    try {
      const commentUserIdStr = targetComment.userId.toString()
      // Do not notify if user likes their own comment
      if (commentUserIdStr === likerUser.id) return null

      const link = chapter
        ? `/stories/${story.slug}/chapters/${chapter.slug}`
        : `/stories/${story.slug}`

      const senderName = likerUser.displayName || likerUser.username || 'Một độc giả'
      const snippet =
        targetComment.content.length > 80 ? `${targetComment.content.slice(0, 80)}...` : targetComment.content

      return await this.createAndEmitNotification(commentUserIdStr, {
        type: 'comment_like',
        title: `${senderName} đã thích bình luận của bạn`,
        message: `"${snippet}" trong tác phẩm "${story.title}"`,
        link,
        meta: {
          senderId: likerUser.id,
          storySlug: story.slug,
          chapterSlug: chapter?.slug,
        },
      })
    } catch (error) {
      logger.error('Error in notifyCommentLike:', error)
      return null
    }
  },
}
