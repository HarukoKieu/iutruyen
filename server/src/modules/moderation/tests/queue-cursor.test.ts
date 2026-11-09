import { describe, expect, it, vi } from 'vitest'
import { moderationService } from '../moderation.service.js'
import { storyRepository } from '../../../repositories/story.repository.js'
import { commentRepository } from '../../../repositories/comment.repository.js'
import { encodeCursor } from '../../../common/pagination.js'
vi.mock('../../../repositories/story.repository.js')
vi.mock('../../../repositories/comment.repository.js')
const cursor = encodeCursor({ createdAt: '2026-01-01T00:00:00.000Z', _id: '123456789012345678901234' })
describe('moderation filters across pages', () => {
  it('preserves story text matching as well as the cursor', async () => {
    vi.mocked(storyRepository.findModerationQueue).mockResolvedValue([])
    await moderationService.getStoryQueue({ search: 'a.*', cursor, sort: 'oldest', limit: 20 })
    const filter = vi.mocked(storyRepository.findModerationQueue).mock.calls.at(-1)![0].filter
    expect(filter.$or).toEqual([{ title: { $regex: 'a\\.\\*', $options: 'i' } }, { description: { $regex: 'a\\.\\*', $options: 'i' } }])
    expect(filter.$and).toHaveLength(1)
  })
  it('preserves spam eligibility on page two', async () => {
    vi.mocked(commentRepository.findSpamQueue).mockResolvedValue([])
    await moderationService.getCommentQueue({ cursor, sort: 'oldest', limit: 20 })
    const filter = vi.mocked(commentRepository.findSpamQueue).mock.calls.at(-1)![0].filter
    expect(filter.$or).toEqual([{ spamScore: { $gt: 0 } }, { isLocked: true }, { isHidden: true }])
    expect(filter.$and).toHaveLength(1)
  })
  it.each(['invalid', encodeCursor({ _id: 'not-an-id', createdAt: 'bad' })])('rejects malformed cursor %s', async value => {
    await expect(moderationService.getStoryQueue({ cursor: value, limit: 20, sort: 'newest' })).rejects.toMatchObject({ statusCode: 400 })
  })
})
