import { describe, it, expect } from 'vitest'
import {
  createCommentSchema,
  updateCommentSchema,
  queryCommentsSchema,
} from '../comments.validation.js'

describe('Comments Validation Schemas', () => {
  describe('createCommentSchema', () => {
    it('should validate correct comment data', () => {
      const valid = {
        storyId: '507f1f77bcf86cd799439011',
        chapterId: '507f1f77bcf86cd799439012',
        content: 'Chương này diễn biến nhanh quá!',
      }
      const result = createCommentSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('should allow optional chapterId', () => {
      const valid = {
        storyId: '507f1f77bcf86cd799439011',
        content: 'Bình luận cấp truyện',
      }
      const result = createCommentSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('should fail if content is empty', () => {
      const invalid = {
        storyId: '507f1f77bcf86cd799439011',
        content: '',
      }
      const result = createCommentSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should fail if content exceeds 1000 characters', () => {
      const invalid = {
        storyId: '507f1f77bcf86cd799439011',
        content: 'a'.repeat(1001),
      }
      const result = createCommentSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('updateCommentSchema', () => {
    it('should validate valid update content', () => {
      const valid = { content: 'Nội dung bình luận đã được chỉnh sửa' }
      const result = updateCommentSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('should fail on empty content', () => {
      const invalid = { content: '' }
      const result = updateCommentSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('queryCommentsSchema', () => {
    it('should set default values for query params', () => {
      const query = { storyId: '507f1f77bcf86cd799439011' }
      const result = queryCommentsSchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sort).toBe('newest')
        expect(result.data.limit).toBe(20)
      }
    })

    it('should accept top sort and custom limit', () => {
      const query = {
        storyId: '507f1f77bcf86cd799439011',
        sort: 'top',
        limit: '10',
      }
      const result = queryCommentsSchema.safeParse(query)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sort).toBe('top')
        expect(result.data.limit).toBe(10)
      }
    })
  })
})
