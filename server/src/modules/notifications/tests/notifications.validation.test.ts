import { describe, it, expect } from 'vitest'
import {
  notificationIdParamSchema,
  queryNotificationsSchema,
} from '../notifications.validation.js'

describe('Notifications Validation Schemas', () => {
  describe('notificationIdParamSchema', () => {
    it('should pass with valid 24-char ObjectId', () => {
      const validId = '507f1f77bcf86cd799439011'
      const result = notificationIdParamSchema.safeParse({ id: validId })
      expect(result.success).toBe(true)
    })

    it('should fail with invalid ObjectId', () => {
      const invalidId = '123-not-an-objectid'
      const result = notificationIdParamSchema.safeParse({ id: invalidId })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Notification ID không đúng định dạng ObjectId')
      }
    })
  })

  describe('queryNotificationsSchema', () => {
    it('should parse boolean isRead correctly', () => {
      const parsedTrue = queryNotificationsSchema.parse({ isRead: 'true' })
      expect(parsedTrue.isRead).toBe(true)

      const parsedFalse = queryNotificationsSchema.parse({ isRead: 'false' })
      expect(parsedFalse.isRead).toBe(false)

      const parsedEmpty = queryNotificationsSchema.parse({})
      expect(parsedEmpty.isRead).toBeUndefined()
    })

    it('should accept valid notification types', () => {
      const validTypes = [
        'new_chapter',
        'new_follow',
        'comment_reply',
        'comment_like',
        'system',
      ] as const

      for (const type of validTypes) {
        const result = queryNotificationsSchema.safeParse({ type })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid notification type', () => {
      const result = queryNotificationsSchema.safeParse({ type: 'invalid_type' })
      expect(result.success).toBe(false)
    })

    it.each(['payment_success', 'refund_status', 'payout_completed'])('rejects retired notification type %s', type => {
      expect(queryNotificationsSchema.safeParse({ type }).success).toBe(false)
    })

    it('should clamp limit between 1 and 50', () => {
      const parsedDefault = queryNotificationsSchema.parse({})
      expect(parsedDefault.limit).toBe(20)

      const parsedCustom = queryNotificationsSchema.parse({ limit: '35' })
      expect(parsedCustom.limit).toBe(35)

      const parsedTooHigh = queryNotificationsSchema.safeParse({ limit: '100' })
      expect(parsedTooHigh.success).toBe(false)

      const parsedTooLow = queryNotificationsSchema.safeParse({ limit: '0' })
      expect(parsedTooLow.success).toBe(false)
    })

    it('should validate cursor format', () => {
      const validCursor = '507f1f77bcf86cd799439011'
      const resultValid = queryNotificationsSchema.safeParse({ cursor: validCursor })
      expect(resultValid.success).toBe(true)

      const resultInvalid = queryNotificationsSchema.safeParse({ cursor: 'invalid' })
      expect(resultInvalid.success).toBe(false)
    })
  })
})
