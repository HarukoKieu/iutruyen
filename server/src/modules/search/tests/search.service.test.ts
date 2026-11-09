import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  searchStories,
  getSuggestions,
  getUserSearchHistory,
  deleteUserSearchHistory,
} from '../search.service.js'
import { storyRepository } from '../../../repositories/story.repository.js'
import { genreRepository } from '../../../repositories/genre.repository.js'
import { searchHistoryRepository } from '../../../repositories/search-history.repository.js'
import { redis } from '../../../config/redis.js'

vi.mock('../../../repositories/story.repository.js', () => ({
  storyRepository: {
    searchStories: vi.fn(),
    findQuickSuggestions: vi.fn(),
    findPublicSuggestionsByIds: vi.fn(),
  },
}))

vi.mock('../../../repositories/genre.repository.js', () => ({
  genreRepository: {
    findBySlug: vi.fn(),
  },
}))

vi.mock('../../../repositories/search-history.repository.js', () => ({
  searchHistoryRepository: {
    upsert: vi.fn(),
    findByUserId: vi.fn(),
    deleteItem: vi.fn(),
    clearAll: vi.fn(),
  },
}))

vi.mock('../../../config/redis.js', () => ({
  redis: {
    status: 'ready',
    get: vi.fn(),
    set: vi.fn(),
  },
}))

describe('Search Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('searchStories', () => {
    it('should call storyRepository.searchStories with correct parameters', async () => {
      const mockResult = {
        stories: [{ _id: 'story-1', title: 'Phàm Nhân Tu Tiên' }],
        meta: { limit: 20, nextCursor: null, hasMore: false },
      }
      vi.mocked(storyRepository.searchStories).mockResolvedValue(mockResult as any)

      const result = await searchStories({
        q: 'Phàm Nhân',
        limit: 20,
        sort: 'views',
        status: 'completed',
      })

      expect(result).toEqual(mockResult)
      expect(storyRepository.searchStories).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'Phàm Nhân',
          limit: 20,
          sort: 'views',
          status: 'completed',
        })
      )
    })

    it('should map genre slug to ObjectId when genre slug is provided', async () => {
      vi.mocked(genreRepository.findBySlug).mockResolvedValue({
        _id: '6aafdb5642ceda89929db506',
        name: 'Tiên Hiệp',
        slug: 'tien-hiep',
      } as any)

      vi.mocked(storyRepository.searchStories).mockResolvedValue({
        stories: [],
        meta: { limit: 20, nextCursor: null, hasMore: false },
      } as any)

      await searchStories({
        genre: 'tien-hiep',
        limit: 20,
        sort: 'relevance',
      })

      expect(genreRepository.findBySlug).toHaveBeenCalledWith('tien-hiep')
      expect(storyRepository.searchStories).toHaveBeenCalledWith(
        expect.objectContaining({
          genreId: '6aafdb5642ceda89929db506',
        })
      )
    })

    it('should record search history for authenticated user when query length >= 2', async () => {
      vi.mocked(storyRepository.searchStories).mockResolvedValue({
        stories: [],
        meta: { limit: 20, nextCursor: null, hasMore: false },
      } as any)
      vi.mocked(searchHistoryRepository.upsert).mockResolvedValue({} as any)

      await searchStories(
        { q: 'Huyền huyễn', limit: 20, sort: 'relevance' },
        'user-123'
      )

      expect(searchHistoryRepository.upsert).toHaveBeenCalledWith(
        'user-123',
        'Huyền huyễn'
      )
    })

    it('should not record search history if userId is missing', async () => {
      vi.mocked(storyRepository.searchStories).mockResolvedValue({
        stories: [],
        meta: { limit: 20, nextCursor: null, hasMore: false },
      } as any)

      await searchStories({ q: 'Đấu La', limit: 20, sort: 'relevance' })
      expect(searchHistoryRepository.upsert).not.toHaveBeenCalled()
    })
  })

  describe('getSuggestions', () => {
    it('should return cached suggestions if available in Redis', async () => {
      const cached = {
        suggestions: ['tiên nghịch', 'tiên hiệp'],
        stories: [{ _id: 's1', title: 'Tiên Nghịch' }],
        trending: ['Tiên Hiệp'],
      }
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cached))

      vi.mocked(storyRepository.findPublicSuggestionsByIds).mockResolvedValue([])
      const result = await getSuggestions('tiên')

      expect(redis.set).not.toHaveBeenCalled()
      expect(result.suggestions).toEqual([])
      expect(result.stories).toEqual([])
      expect(storyRepository.findQuickSuggestions).not.toHaveBeenCalled()
    })

    it('should query DB and store in Redis cache when cache miss', async () => {
      vi.mocked(redis.get).mockResolvedValue(null)
      const mockStories = [
        {
          _id: { toString: () => 'story-1' },
          title: 'Vạn Cổ Thần Thoại',
          slug: 'van-co-than-thoai',
          coverUrl: 'http://example.com/cover.jpg',
          ratingAverage: 4.8,
          viewCount: 1500,
          status: 'ongoing',
          authorId: { displayName: 'Lão Ma', username: 'laoma' },
          genreIds: [{ name: 'Huyền Huyễn', slug: 'huyen-huanh' }],
        },
      ]
      vi.mocked(storyRepository.findQuickSuggestions).mockResolvedValue(mockStories as any)

      const result = await getSuggestions('vạn cổ')

      expect(result.suggestions).toContain('Vạn Cổ Thần Thoại')
      expect(result.stories).toHaveLength(1)
      expect(result.stories[0].title).toBe('Vạn Cổ Thần Thoại')
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('cache:search:sug:'),
        expect.any(String),
        'EX',
        300
      )
    })

    it('should include user search history when userId is provided', async () => {
      vi.mocked(redis.get).mockResolvedValue(null)
      vi.mocked(storyRepository.findQuickSuggestions).mockResolvedValue([])
      vi.mocked(searchHistoryRepository.findByUserId).mockResolvedValue([
        { query: 'tiên hiệp tu chân' } as any,
        { query: 'đô thị dị năng' } as any,
      ])

      const result = await getSuggestions('', 'user-456')

      expect(result.history).toEqual(['tiên hiệp tu chân', 'đô thị dị năng'])
      expect(searchHistoryRepository.findByUserId).toHaveBeenCalledWith('user-456', 5)
    })
  })

  describe('getUserSearchHistory', () => {
    it('should return mapped history list', async () => {
      const now = new Date()
      vi.mocked(searchHistoryRepository.findByUserId).mockResolvedValue([
        { _id: { toString: () => 'h1' }, query: 'Tru Tiên', updatedAt: now } as any,
      ])

      const result = await getUserSearchHistory('user-1')
      expect(result).toEqual([
        { _id: 'h1', query: 'Tru Tiên', updatedAt: now },
      ])
    })
  })

  describe('deleteUserSearchHistory', () => {
    it('should delete a specific query item if q is provided', async () => {
      vi.mocked(searchHistoryRepository.deleteItem).mockResolvedValue(true)

      const result = await deleteUserSearchHistory('user-1', 'Tru Tiên')
      expect(searchHistoryRepository.deleteItem).toHaveBeenCalledWith('user-1', 'Tru Tiên')
      expect(result.success).toBe(true)
    })

    it('should clear all history if q is not provided', async () => {
      vi.mocked(searchHistoryRepository.clearAll).mockResolvedValue(5)

      const result = await deleteUserSearchHistory('user-1')
      expect(searchHistoryRepository.clearAll).toHaveBeenCalledWith('user-1')
      expect(result.success).toBe(true)
      expect(result.message).toContain('5')
    })
  })
})
