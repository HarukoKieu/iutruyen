import { describe, it, expect } from 'vitest'
import {
  searchStoriesQuerySchema,
  searchSuggestionsQuerySchema,
  deleteSearchHistoryQuerySchema,
} from '../search.validation.js'

describe('Search Validation Schemas', () => {
  describe('searchStoriesQuerySchema', () => {
    it('should parse with default values when empty', () => {
      const result = searchStoriesQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(20)
        expect(result.data.sort).toBe('relevance')
      }
    })

    it('should parse valid parameters successfully', () => {
      const result = searchStoriesQuerySchema.safeParse({
        q: 'Võ Thần',
        cursor: 'cursor-123',
        limit: '15',
        genre: '6aafdb5642ceda89929db506',
        status: 'ongoing',
        rating: '4.5',
        sort: 'views',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.q).toBe('Võ Thần')
        expect(result.data.limit).toBe(15)
        expect(result.data.status).toBe('ongoing')
        expect(result.data.rating).toBe(4.5)
        expect(result.data.sort).toBe('views')
      }
    })

    it('should reject invalid limit (< 1 or > 50)', () => {
      const tooLow = searchStoriesQuerySchema.safeParse({ limit: '0' })
      expect(tooLow.success).toBe(false)

      const tooHigh = searchStoriesQuerySchema.safeParse({ limit: '100' })
      expect(tooHigh.success).toBe(false)
    })

    it('should reject invalid status', () => {
      const result = searchStoriesQuerySchema.safeParse({ status: 'invalid_status' })
      expect(result.success).toBe(false)
    })

    it('should reject invalid rating (< 0 or > 5)', () => {
      const result = searchStoriesQuerySchema.safeParse({ rating: '6' })
      expect(result.success).toBe(false)
    })

    it('should reject invalid genre id format', () => {
      const result = searchStoriesQuerySchema.safeParse({ genre: 'not-an-object-id' })
      expect(result.success).toBe(false)
    })
  })

  describe('searchSuggestionsQuerySchema', () => {
    it('should default to empty string when q is omitted', () => {
      const result = searchSuggestionsQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.q).toBe('')
      }
    })

    it('should accept valid q query', () => {
      const result = searchSuggestionsQuerySchema.safeParse({ q: 'Đấu Phá' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.q).toBe('Đấu Phá')
      }
    })

    it('should reject q exceeding 100 characters', () => {
      const longQuery = 'a'.repeat(101)
      const result = searchSuggestionsQuerySchema.safeParse({ q: longQuery })
      expect(result.success).toBe(false)
    })
  })

  describe('deleteSearchHistoryQuerySchema', () => {
    it('should accept empty query to clear all', () => {
      const result = deleteSearchHistoryQuerySchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should accept specific q to delete single item', () => {
      const result = deleteSearchHistoryQuerySchema.safeParse({ q: 'Tiên hiệp' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.q).toBe('Tiên hiệp')
      }
    })
  })
})
