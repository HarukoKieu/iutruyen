import { describe, it, expect, vi } from 'vitest'
import { Story } from '../models/Story.model.js'
import { Chapter } from '../models/Chapter.model.js'
import { chapterRepository } from './chapter.repository.js'

vi.mock('../models/Story.model.js', () => ({ Story: { distinct: vi.fn() } }))
vi.mock('../models/Chapter.model.js', () => ({ Chapter: { countDocuments: vi.fn(), find: vi.fn() } }))

describe('Chapter moderation queue parent visibility', () => {
  it('excludes removed stories from the pending badge count', async () => {
    vi.mocked(Story.distinct).mockResolvedValue(['removed-story'])
    vi.mocked(Chapter.countDocuments).mockResolvedValue(2)
    expect(await chapterRepository.countPendingModeration()).toBe(2)
    expect(Chapter.countDocuments).toHaveBeenCalledWith({ moderationStatus: 'pending', storyId: { $nin: ['removed-story'] } })
  })
  it('filters removed parents before pagination', async () => {
    vi.mocked(Story.distinct).mockResolvedValue(['removed-story'])
    const query = { sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), populate: vi.fn().mockResolvedValue([]) }
    vi.mocked(Chapter.find).mockReturnValue(query as never)
    const filter = { moderationStatus: 'pending' }
    await chapterRepository.findModerationQueue({ filter, sortDirection: 1, limit: 20 })
    expect(Chapter.find).toHaveBeenCalledWith({ $and: [filter, { storyId: { $nin: ['removed-story'] } }] })
    expect(query.limit).toHaveBeenCalledWith(21)
  })
})
