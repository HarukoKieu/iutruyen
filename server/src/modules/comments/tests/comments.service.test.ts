import { describe, it, expect, vi, beforeEach } from 'vitest'
import { commentsService } from '../comments.service.js'
import { commentRepository } from '../../../repositories/comment.repository.js'
import { storyRepository } from '../../../repositories/story.repository.js'
import { chapterRepository } from '../../../repositories/chapter.repository.js'
import { notificationsService } from '../../notifications/notifications.service.js'
import { Types } from 'mongoose'

vi.mock('../../../repositories/comment.repository.js')
vi.mock('../../../repositories/story.repository.js')
vi.mock('../../../repositories/chapter.repository.js')
vi.mock('../../notifications/notifications.service.js')

describe('Comments Service - toggleLike', () => {
  const commentId = new Types.ObjectId().toString()
  const authorId = new Types.ObjectId()
  const likerId = new Types.ObjectId().toString()
  const storyId = new Types.ObjectId()

  // Base comment owned by authorId
  const baseComment = {
    _id: new Types.ObjectId(commentId),
    userId: authorId,
    storyId,
    content: 'Bình luận hay quá',
    isDeleted: false,
    likedUserIds: [],
    likeCount: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw 403 when user tries to like their own comment', async () => {
    const sameUserId = authorId.toString()

    vi.mocked(commentRepository.findById).mockResolvedValue(baseComment as any)

    const likerUser = { id: sameUserId, displayName: 'Chính Tôi' }
    await expect(
      commentsService.toggleLike(commentId, sameUserId, likerUser)
    ).rejects.toThrow('Bạn không thể thích bình luận của chính mình')

    // toggleLike on repository should NEVER be called
    expect(commentRepository.toggleLike).not.toHaveBeenCalled()
    expect(notificationsService.notifyCommentLike).not.toHaveBeenCalled()
  })

  it('should trigger notifyCommentLike when user likes another user comment', async () => {
    const mockUpdatedComment = {
      ...baseComment,
      likedUserIds: [new Types.ObjectId(likerId)],
      likeCount: 1,
    }

    vi.mocked(commentRepository.findById).mockResolvedValue(baseComment as any)
    vi.mocked(commentRepository.toggleLike).mockResolvedValue(mockUpdatedComment as any)
    vi.mocked(storyRepository.findById).mockResolvedValue({
      _id: storyId,
      title: 'Truyện Test',
      slug: 'truyen-test',
    } as any)

    const likerUser = { id: likerId, displayName: 'Người Thích' }
    const result = await commentsService.toggleLike(commentId, likerId, likerUser)

    expect(result.likeCount).toBe(1)
    expect(commentRepository.toggleLike).toHaveBeenCalledWith(commentId, likerId)

    // Wait microtask tick for async notification trigger
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(storyRepository.findById).toHaveBeenCalledWith(storyId.toString())
    expect(notificationsService.notifyCommentLike).toHaveBeenCalledWith(
      { userId: authorId, content: 'Bình luận hay quá' },
      likerUser,
      { slug: 'truyen-test', title: 'Truyện Test' },
      undefined
    )
  })

  it('should NOT trigger notification when user unlikes a comment', async () => {
    const mockUpdatedComment = {
      ...baseComment,
      likedUserIds: [], // Empty, meaning unliked
      likeCount: 0,
    }

    vi.mocked(commentRepository.findById).mockResolvedValue(baseComment as any)
    vi.mocked(commentRepository.toggleLike).mockResolvedValue(mockUpdatedComment as any)

    const likerUser = { id: likerId, displayName: 'Người Thích' }
    const result = await commentsService.toggleLike(commentId, likerId, likerUser)

    expect(result.likeCount).toBe(0)

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(notificationsService.notifyCommentLike).not.toHaveBeenCalled()
  })
})
