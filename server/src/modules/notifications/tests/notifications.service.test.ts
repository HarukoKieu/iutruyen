import { storyRepository } from '../../../repositories/story.repository.js'
import { chapterRepository } from '../../../repositories/chapter.repository.js'
vi.mock('../../../repositories/story.repository.js')
vi.mock('../../../repositories/chapter.repository.js')
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notificationsService } from '../notifications.service.js'
import { notificationRepository } from '../../../repositories/notification.repository.js'
import { followRepository } from '../../../repositories/follow.repository.js'
import * as socketConfig from '../../../config/socket.js'
import { Types } from 'mongoose'

vi.mock('../../../repositories/notification.repository.js')
vi.mock('../../../repositories/follow.repository.js')
vi.mock('../../../config/socket.js')

describe('Notifications Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(storyRepository.findById).mockResolvedValue({ moderationStatus: 'approved' } as any)
    vi.mocked(chapterRepository.findById).mockResolvedValue({ status: 'published', moderationStatus: 'approved' } as any)
  })

  describe('getUserNotifications', () => {
    it('should return notifications list, unreadCount, and nextCursor', async () => {
      const mockNotifications = [
        { _id: new Types.ObjectId(), title: 'Chương mới', isRead: false },
        { _id: new Types.ObjectId(), title: 'Thông báo hệ thống', isRead: true },
      ]

      vi.mocked(notificationRepository.findByUserId).mockResolvedValue({
        notifications: mockNotifications as any,
        nextCursor: 'next-cursor-id',
      })
      vi.mocked(notificationRepository.countUnread).mockResolvedValue(1)

      const result = await notificationsService.getUserNotifications('user-1', {
        limit: 20,
      })

      expect(result.notifications).toHaveLength(2)
      expect(result.unreadCount).toBe(1)
      expect(result.nextCursor).toBe('next-cursor-id')
      expect(notificationRepository.findByUserId).toHaveBeenCalledWith('user-1', {
        isRead: undefined,
        type: undefined,
        cursor: undefined,
        limit: 20,
      })
    })
  })

  describe('markAsRead & markAllAsRead', () => {
    it('should mark single notification as read', async () => {
      const mockUpdated = { _id: 'notif-1', isRead: true }
      vi.mocked(notificationRepository.markAsRead).mockResolvedValue(mockUpdated as any)

      const result = await notificationsService.markAsRead('user-1', 'notif-1')
      expect(result.isRead).toBe(true)
      expect(notificationRepository.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1')
    })

    it('should throw AppError if notification not found when marking read', async () => {
      vi.mocked(notificationRepository.markAsRead).mockResolvedValue(null)

      await expect(
        notificationsService.markAsRead('user-1', 'notif-404')
      ).rejects.toThrow('Thông báo không tồn tại hoặc không thuộc về bạn')
    })

    it('should mark all notifications as read', async () => {
      vi.mocked(notificationRepository.markAllAsRead).mockResolvedValue(5)

      const modifiedCount = await notificationsService.markAllAsRead('user-1')
      expect(modifiedCount).toBe(5)
      expect(notificationRepository.markAllAsRead).toHaveBeenCalledWith('user-1')
    })
  })

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      vi.mocked(notificationRepository.delete).mockResolvedValue(true)

      const success = await notificationsService.deleteNotification('user-1', 'notif-1')
      expect(success).toBe(true)
      expect(notificationRepository.delete).toHaveBeenCalledWith('notif-1', 'user-1')
    })

    it('should throw AppError if notification not found when deleting', async () => {
      vi.mocked(notificationRepository.delete).mockResolvedValue(false)

      await expect(
        notificationsService.deleteNotification('user-1', 'notif-404')
      ).rejects.toThrow('Thông báo không tồn tại hoặc không thuộc về bạn')
    })
  })

  describe('notifyNewChapter', () => {
    it('should fan-out notifications to all followers excluding author', async () => {
      const storyId = new Types.ObjectId()
      const authorId = new Types.ObjectId()
      const follower1 = new Types.ObjectId()
      const follower2 = new Types.ObjectId()

      const story = {
        _id: storyId,
        title: 'Đấu La Đại Lục',
        slug: 'dau-la-dai-luc',
        authorId,
      }

      const chapter = {
        _id: new Types.ObjectId(),
        title: 'Chương 10: Võ Hồn Thức Tỉnh',
        slug: 'chuong-10-vo-hon-thuc-tinh',
        order: 10,
      }

      // Mock followers (follower1, follower2, and author itself)
      vi.mocked(followRepository.findFollowersByStoryId).mockResolvedValue([
        { userId: follower1, storyId },
        { userId: follower2, storyId },
        { userId: authorId, storyId }, // Should be excluded
      ] as any)

      vi.mocked(notificationRepository.createMany).mockResolvedValue([
        { _id: new Types.ObjectId(), userId: follower1 },
        { _id: new Types.ObjectId(), userId: follower2 },
      ] as any)

      const createdCount = await notificationsService.notifyNewChapter(story, chapter)

      expect(createdCount).toBe(2)
      expect(notificationRepository.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: follower1,
            type: 'new_chapter',
            title: 'Chương mới: Đấu La Đại Lục',
          }),
          expect.objectContaining({
            userId: follower2,
            type: 'new_chapter',
          }),
        ])
      )
      expect(socketConfig.emitToUser).toHaveBeenCalledTimes(2)
      for (const call of vi.mocked(socketConfig.emitToUser).mock.calls) {
        expect(call[2]).toHaveProperty('_id')
        expect(call[2]).not.toHaveProperty('notification')
      }
    })

    it('should return 0 when story has no followers', async () => {
      vi.mocked(followRepository.findFollowersByStoryId).mockResolvedValue([])

      const count = await notificationsService.notifyNewChapter(
        { _id: 's-1', title: 'Story', slug: 'story', authorId: 'a-1' },
        { _id: 'c-1', title: 'Chap 1', slug: 'chap-1', order: 1 }
      )

      expect(count).toBe(0)
      expect(notificationRepository.createMany).not.toHaveBeenCalled()
    })
  })

  describe('notifyCommentReply', () => {
    it('should send notification to parent comment author', async () => {
      const parentComment = { userId: new Types.ObjectId('507f1f77bcf86cd799439011') }
      const replyUser = { id: 'user-replier', displayName: 'Hàn Lập' }

      vi.mocked(notificationRepository.create).mockResolvedValue({
        _id: new Types.ObjectId(),
        type: 'comment_reply',
      } as any)
      vi.mocked(notificationRepository.countUnread).mockResolvedValue(1)

      const result = await notificationsService.notifyCommentReply(
        parentComment,
        replyUser,
        'Cảm ơn bạn đã chia sẻ!',
        { slug: 'truyen-hay', title: 'Truyện Hay' }
      )

      expect(result).not.toBeNull()
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '507f1f77bcf86cd799439011',
          type: 'comment_reply',
          title: 'Hàn Lập đã trả lời bình luận của bạn',
        })
      )
      expect(socketConfig.emitToUser).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'notification:new',
        expect.any(Object)
      )
    })

    it('should NOT notify if user replies to their own comment', async () => {
      const parentComment = { userId: 'user-same' }
      const replyUser = { id: 'user-same' }

      const result = await notificationsService.notifyCommentReply(
        parentComment,
        replyUser,
        'Tự trả lời chính mình',
        { slug: 'truyen', title: 'Truyện' }
      )

      expect(result).toBeNull()
      expect(notificationRepository.create).not.toHaveBeenCalled()
    })
  })

  describe('notifyNewFollow', () => {
    it('should send notification to author when someone follows story', async () => {
      const story = {
        _id: 'story-1',
        title: 'Tiên Nghịch',
        slug: 'tien-nghich',
        authorId: 'author-123',
      }
      const follower = { id: 'reader-99', displayName: 'Vương Lâm' }

      vi.mocked(notificationRepository.create).mockResolvedValue({
        _id: new Types.ObjectId(),
        type: 'new_follow',
      } as any)

      const result = await notificationsService.notifyNewFollow(story, follower)

      expect(result).not.toBeNull()
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'author-123',
          type: 'new_follow',
          title: 'Có người theo dõi mới',
          message: expect.stringContaining('Vương Lâm'),
        })
      )
    })

    it('should NOT notify if author follows their own story', async () => {
      const story = {
        _id: 'story-1',
        title: 'Tiên Nghịch',
        slug: 'tien-nghich',
        authorId: 'author-123',
      }
      const follower = { id: 'author-123' }

      const result = await notificationsService.notifyNewFollow(story, follower)

      expect(result).toBeNull()
      expect(notificationRepository.create).not.toHaveBeenCalled()
    })
  })

  describe('notifyCommentLike', () => {
    it('should send notification to comment author when another user likes comment', async () => {
      const targetComment = {
        userId: 'author-123',
        content: 'Chương này tình tiết rất cuốn!',
      }
      const liker = { id: 'user-456', displayName: 'Độc Giả A' }
      const story = { slug: 'tien-nghich', title: 'Tiên Nghịch' }
      const chapter = { slug: 'chuong-1', title: 'Chương 1' }

      vi.mocked(notificationRepository.create).mockResolvedValue({
        _id: new Types.ObjectId(),
        type: 'comment_like',
      } as any)

      const result = await notificationsService.notifyCommentLike(
        targetComment,
        liker,
        story,
        chapter
      )

      expect(result).not.toBeNull()
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'author-123',
          type: 'comment_like',
          title: 'Độc Giả A đã thích bình luận của bạn',
          message: expect.stringContaining('Chương này tình tiết rất cuốn!'),
          link: '/stories/tien-nghich/chapters/chuong-1',
          meta: expect.objectContaining({
            senderId: 'user-456',
            storySlug: 'tien-nghich',
            chapterSlug: 'chuong-1',
          }),
        })
      )
    })

    it('should NOT notify if user likes their own comment', async () => {
      const targetComment = {
        userId: 'author-123',
        content: 'Bình luận của chính tôi',
      }
      const liker = { id: 'author-123' }
      const story = { slug: 'tien-nghich', title: 'Tiên Nghịch' }

      const result = await notificationsService.notifyCommentLike(
        targetComment,
        liker,
        story
      )

      expect(result).toBeNull()
      expect(notificationRepository.create).not.toHaveBeenCalled()
    })
  })
})
