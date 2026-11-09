import { describe, it, expect, vi, beforeEach } from 'vitest'
import { followsService } from '../follows.service.js'
import { followRepository } from '../../../repositories/follow.repository.js'
import { notificationsService } from '../../notifications/notifications.service.js'
import { AppError } from '../../../common/AppError.js'
import { Types } from 'mongoose'

vi.mock('../../../repositories/follow.repository.js')
vi.mock('../../notifications/notifications.service.js')

describe('Follows service transaction boundary', () => {
  const storyId = new Types.ObjectId().toString(), userId = new Types.ObjectId().toString()
  beforeEach(() => vi.resetAllMocks())
  it('returns committed count and notifies only after a new follow', async () => {
    const story = { _id: storyId, title: 'Story', slug: 'story', authorId: userId }
    vi.mocked(followRepository.change).mockResolvedValue({ story, isFollowing: true, followCount: 15 } as never)
    vi.mocked(notificationsService.notifyNewFollow).mockResolvedValue(null)
    const follower = { id: userId, displayName: 'Reader' }
    expect(await followsService.toggleFollow(userId, storyId, follower)).toEqual({ isFollowing: true, followCount: 15 })
    expect(followRepository.change).toHaveBeenCalledWith(userId, storyId, 'toggle')
    expect(notificationsService.notifyNewFollow).toHaveBeenCalledWith(story, follower)
  })
  it('does not notify for a toggle removing a follow', async () => {
    vi.mocked(followRepository.change).mockResolvedValue({ isFollowing: false, followCount: 14 } as never)
    expect(await followsService.toggleFollow(userId, storyId, { id: userId })).toEqual({ isFollowing: false, followCount: 14 })
    expect(notificationsService.notifyNewFollow).not.toHaveBeenCalled()
  })
  it('rejects invalid identifiers before calling the repository', async () => {
    await expect(followsService.toggleFollow(userId, 'invalid')).rejects.toMatchObject({ statusCode: 400 })
    await expect(followsService.unfollow(userId, 'invalid')).rejects.toMatchObject({ statusCode: 400 })
    expect(followRepository.change).not.toHaveBeenCalled()
  })
  it('propagates transaction errors without emitting a notification', async () => {
    vi.mocked(followRepository.change).mockRejectedValue(AppError.notFound('Truyện không tồn tại'))
    await expect(followsService.toggleFollow(userId, storyId, { id: userId })).rejects.toMatchObject({ statusCode: 404 })
    expect(notificationsService.notifyNewFollow).not.toHaveBeenCalled()
  })
  it('uses idempotent removal rather than toggle for unfollow', async () => {
    vi.mocked(followRepository.change).mockResolvedValue({ isFollowing: false, followCount: 5 } as never)
    expect(await followsService.unfollow(userId, storyId)).toEqual({ isFollowing: false, followCount: 5 })
    expect(followRepository.change).toHaveBeenCalledWith(userId, storyId, 'remove')
  })
  it.each([true, false])('reports following status %s', async exists => {
    vi.mocked(followRepository.findOne).mockResolvedValue(exists ? { _id: new Types.ObjectId() } as never : null)
    expect(await followsService.checkFollow(userId, storyId)).toEqual({ isFollowing: exists })
  })
  it('keeps list reads in the repository', async () => {
    vi.mocked(followRepository.findByUserId).mockResolvedValue([])
    expect(await followsService.getUserFollows(userId, 20)).toEqual([])
    expect(followRepository.findByUserId).toHaveBeenCalledWith(userId, 20)
  })
})
