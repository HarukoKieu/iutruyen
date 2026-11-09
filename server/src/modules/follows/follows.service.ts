import { followRepository } from '../../repositories/follow.repository.js'
import { notificationsService } from '../notifications/notifications.service.js'
import { AppError } from '../../common/AppError.js'
import { Types } from 'mongoose'
import { personalPage } from '../../common/personalPagination.js'

export const followsService = {
  async toggleFollow(
    userId: string,
    storyId: string,
    followerUser?: { id: string; displayName?: string; username?: string }
  ) {
    if (!Types.ObjectId.isValid(storyId)) {
      throw AppError.badRequest('Story ID không hợp lệ', 'INVALID_STORY_ID')
    }

    const { story, isFollowing, followCount } = await followRepository.change(userId, storyId, 'toggle')
    if (isFollowing && followerUser) {
      void notificationsService.notifyNewFollow(story, followerUser).catch(() => {})
    }
    return { isFollowing, followCount }
  },

  async unfollow(userId: string, storyId: string) {
    if (!Types.ObjectId.isValid(storyId)) throw AppError.badRequest('Story ID không hợp lệ', 'INVALID_STORY_ID')
    const { isFollowing, followCount } = await followRepository.change(userId, storyId, 'remove')
    return { isFollowing, followCount }
  },

  async checkFollow(userId: string, storyId: string) {
    if (!Types.ObjectId.isValid(storyId)) {
      return { isFollowing: false }
    }
    const follow = await followRepository.findOne(userId, storyId)
    return { isFollowing: !!follow }
  },

  async getUserFollows(userId: string, limit: number = 50) {
    return followRepository.findByUserId(userId, limit)
  },
  async getUserFollowsPage(userId: string, limit: number, cursor?: string) {
    return personalPage(await followRepository.findByUserId(userId, limit + 1, cursor), limit, 'createdAt', row => row.storyId)
  },
}
