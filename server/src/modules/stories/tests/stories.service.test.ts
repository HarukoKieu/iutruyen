import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getStories,
  getStoryBySlug,
  createStory,
  updateStory,
  getRanking,
} from '../stories.service.js'
import { storyRepository } from '../../../repositories/story.repository.js'
import { genreRepository } from '../../../repositories/genre.repository.js'
import { tagRepository } from '../../../repositories/tag.repository.js'
import { AppError } from '../../../common/AppError.js'
import { Types } from 'mongoose'
vi.mock('../../../common/readView.js', () => ({ recordReadView: vi.fn(async (_resource: string, visitor: string | undefined, increment: () => Promise<unknown>) => {
  if (!visitor) return false
  await increment(); return true
}) }))

vi.mock('../../chapters/crawler.config.js', () => ({ resolveSource: vi.fn() }))
vi.mock('../../../repositories/crawler-story-source.repository.js', () => ({ crawlerStorySourceRepository: {
  initialize: vi.fn(), find: vi.fn(), createStory: vi.fn(),
} }))

// Mock repositories
vi.mock('../../../repositories/story.repository.js', () => ({
  storyRepository: {
    findStories: vi.fn(),
    findBySlug: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateById: vi.fn(),
    getRanking: vi.fn(),
    incrementViewCount: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../repositories/genre.repository.js', () => ({
  genreRepository: {
    findByIds: vi.fn(),
    findBySlug: vi.fn(),
  },
}))

vi.mock('../../../repositories/tag.repository.js', () => ({
  tagRepository: {
    findByIds: vi.fn(),
    findBySlug: vi.fn(),
    findByNamesOrCreate: vi.fn(),
  },
}))

describe('Stories Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStories', () => {
    it('should query stories with approved moderationStatus', async () => {
      const mockResult = {
        data: [{ _id: 'story-1', title: 'Tiên Nghịch' }],
        meta: { limit: 20, nextCursor: null, hasMore: false },
      }
      vi.mocked(storyRepository.findStories).mockResolvedValue(mockResult as any)

      const result = await getStories({ limit: 20, sort: 'hot' })
      expect(result).toEqual(mockResult)
      expect(storyRepository.findStories).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          sort: 'hot',
          moderationStatus: 'approved',
        })
      )
    })

    it('should pass authorId when author parameter is provided', async () => {
      const mockResult = {
        data: [{ _id: 'story-1', title: 'Tiên Nghịch' }],
        meta: { limit: 20, nextCursor: null, hasMore: false },
      }
      vi.mocked(storyRepository.findStories).mockResolvedValue(mockResult as any)

      await getStories({ limit: 20, author: 'author-123' })
      expect(storyRepository.findStories).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: 'author-123',
          moderationStatus: 'approved',
        })
      )
    })
  })

  describe('getStoryBySlug', () => {
    it('should return story and increment view count', async () => {
      const fakeStory = {
        _id: 'story-1',
        title: 'Phàm Nhân Tu Tiên',
        slug: 'pham-nhan-tu-tien',
        viewCount: 100,
        moderationStatus: 'approved',
      }
      vi.mocked(storyRepository.findBySlug).mockResolvedValue(fakeStory as any)

      const result = await getStoryBySlug('pham-nhan-tu-tien', '192.0.2.1')
      expect(result.title).toBe('Phàm Nhân Tu Tiên')
      expect(result.viewCount).toBe(101)
      expect(storyRepository.incrementViewCount).toHaveBeenCalledWith('story-1')
    })

    it('should throw notFound if story is not found or removed', async () => {
      vi.mocked(storyRepository.findBySlug).mockResolvedValue(null)

      await expect(getStoryBySlug('non-existent')).rejects.toThrowError(AppError)
    })
  })

  describe('createStory', () => {
    it('should throw badRequest if genreIds are invalid', async () => {
      vi.mocked(genreRepository.findByIds).mockResolvedValue([])

      await expect(
        createStory('author-123', {
          title: 'New Story',
          description: 'Desc',
          genreIds: ['invalid-id'],
          tagIds: [],
          tags: [],
          status: 'ongoing',
          contentWarning: 'none',
        })
      ).rejects.toThrowError(AppError)
    })

    it('should create story with generated slug', async () => {
      const gId = new Types.ObjectId()
      const authorId = new Types.ObjectId()
      vi.mocked(genreRepository.findByIds).mockResolvedValue([{ _id: gId }] as any)
      vi.mocked(storyRepository.findBySlug).mockResolvedValue(null) // slug is unique

      const fakeCreated = {
        _id: 'new-story-id',
        title: 'Vạn Cổ Thần Thoại',
        slug: 'van-co-than-thoai',
        authorId: authorId.toString(),
      }
      vi.mocked(storyRepository.create).mockResolvedValue(fakeCreated as any)
      vi.mocked(storyRepository.findById).mockResolvedValue(fakeCreated as any)

      const result = await createStory(authorId.toString(), {
        title: 'Vạn Cổ Thần Thoại',
        description: 'Mô tả truyện...',
        originalAuthor: 'Tác giả nguồn',
        sourceName: 'Sưu tầm',
        genreIds: [gId.toString()],
        tagIds: [],
        tags: [],
        status: 'ongoing',
        contentWarning: 'none',
      })

      expect(result).toBeDefined()
      expect(result!.title).toBe('Vạn Cổ Thần Thoại')
      expect(result!.slug).toBe('van-co-than-thoai')
      expect(storyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Vạn Cổ Thần Thoại',
          slug: 'van-co-than-thoai',
          originalAuthor: 'Tác giả nguồn',
          sourceName: 'Sưu tầm',
          authorId: expect.any(Types.ObjectId),
        })
      )
    })
  })

  describe('getRanking', () => {
    it('updates attribution without changing the owner and allows clearing imported attribution', async () => {
      vi.mocked(storyRepository.findById).mockResolvedValue({ title: 'Story', authorId: new Types.ObjectId() } as any)
      await updateStory('story', { originalAuthor: 'A', sourceName: 'Nguồn B' })
      expect(storyRepository.updateById).toHaveBeenLastCalledWith('story', { originalAuthor: 'A', sourceName: 'Nguồn B', moderationStatus: 'pending' })
      await updateStory('story', { originalAuthor: '', sourceName: '' })
      expect(storyRepository.updateById).toHaveBeenLastCalledWith('story', { originalAuthor: '', sourceName: '', moderationStatus: 'pending' })
    })
    it('should query ranking with default metrics and cursor pagination', async () => {
      const mockResult = {
        stories: [{ _id: 'story-1', title: 'Top 1 Story', viewCount: 1000 }],
        meta: { limit: 20, nextCursor: null, hasMore: false },
      }
      vi.mocked(storyRepository.getRanking).mockResolvedValue(mockResult as any)

      const result = await getRanking({ metric: 'views', cursor: null, limit: 20 })
      expect(result).toEqual(mockResult)
      expect(storyRepository.getRanking).toHaveBeenCalledWith({
          catalogProjection: true,
        metric: 'views',
        period: undefined,
        genreId: undefined,
        cursor: null,
        limit: 20,
      })
    })

    it('should resolve genre slug to ObjectId if genre is a slug', async () => {
      const genreObjId = new Types.ObjectId()
      vi.mocked(genreRepository.findBySlug).mockResolvedValue({
        _id: genreObjId,
        slug: 'tien-hiep',
      } as any)

      const mockResult = {
        stories: [],
        meta: { limit: 20, nextCursor: null, hasMore: false },
      }
      vi.mocked(storyRepository.getRanking).mockResolvedValue(mockResult as any)

      await getRanking({ metric: 'follows', genre: 'tien-hiep', cursor: null, limit: 20 })

      expect(genreRepository.findBySlug).toHaveBeenCalledWith('tien-hiep')
      expect(storyRepository.getRanking).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: 'follows',
          genreId: genreObjId.toString(),
          cursor: null,
          limit: 20,
        })
      )
    })
  })
})

