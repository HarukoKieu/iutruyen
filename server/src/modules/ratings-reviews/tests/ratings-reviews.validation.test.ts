import { describe, it, expect } from 'vitest'
import {
  upsertRatingSchema,
  upsertReviewSchema,
  queryReviewsSchema,
} from '../ratings-reviews.validation.js'

describe('Ratings & Reviews Validation Schemas', () => {
  describe('upsertRatingSchema', () => {
    it('should validate score between 1 and 5', () => {
      [1, 2, 3, 4, 5].forEach((score) => {
        const result = upsertRatingSchema.safeParse({ score })
        expect(result.success).toBe(true)
      })
    })

    it('should reject score less than 1', () => {
      const result = upsertRatingSchema.safeParse({ score: 0 })
      expect(result.success).toBe(false)
    })

    it('should reject score greater than 5', () => {
      const result = upsertRatingSchema.safeParse({ score: 6 })
      expect(result.success).toBe(false)
    })

    it('should reject non-integer score', () => {
      const result = upsertRatingSchema.safeParse({ score: 4.5 })
      expect(result.success).toBe(false)
    })
  })

  describe('upsertReviewSchema', () => {
    it('should accept review content >= 50 characters', () => {
      const valid = {
        content: 'Truyện viết rất hay, nhân vật chính phát triển tâm lý tự nhiên và logic, đáng để đọc!',
      }
      const result = upsertReviewSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('should reject review content < 50 characters', () => {
      const invalid = { content: 'Truyện hay lắm!' }
      const result = upsertReviewSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should reject review content > 3000 characters', () => {
      const invalid = { content: 'a'.repeat(3001) }
      const result = upsertReviewSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('queryReviewsSchema', () => {
    it('should set default values for review query params', () => {
      const result = queryReviewsSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sort).toBe('newest')
        expect(result.data.limit).toBe(10)
      }
    })
  })
})
