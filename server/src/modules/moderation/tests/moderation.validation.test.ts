import { describe, it, expect } from 'vitest'
import {
  queueQuerySchema,
  moderationActionSchema,
  createReportSchema,
  reportActionSchema,
  addReportNoteSchema,
  historyQuerySchema,
} from '../moderation.validation.js'

describe('Moderation Validation Schemas', () => {
  describe('queueQuerySchema', () => {
    it('applies default sort and limit when empty', () => {
      const result = queueQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sort).toBe('oldest')
        expect(result.data.limit).toBe(20)
      }
    })

    it('rejects limit greater than 50 or less than 1', () => {
      expect(queueQuerySchema.safeParse({ limit: 100 }).success).toBe(false)
      expect(queueQuerySchema.safeParse({ limit: 0 }).success).toBe(false)
    })
  })

  describe('moderationActionSchema', () => {
    it('parses valid action body with reason and note', () => {
      const result = moderationActionSchema.safeParse({
        reason: 'Vi phạm bản quyền',
        note: 'Tác giả chưa cấp phép',
        notifyUser: true,
      })
      expect(result.success).toBe(true)
    })

    it('defaults notifyUser to true', () => {
      const result = moderationActionSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.notifyUser).toBe(true)
      }
    })
  })

  describe('createReportSchema', () => {
    const validId = '507f1f77bcf86cd799439011'

    it('validates a correct report submission', () => {
      const result = createReportSchema.safeParse({
        targetType: 'story',
        targetId: validId,
        reason: 'Nội dung 18+ không gắn nhãn',
        description: 'Chương 3 có cảnh nhạy cảm',
        evidenceUrls: ['https://example.com/screenshot.png'],
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid targetType or invalid ObjectId', () => {
      expect(
        createReportSchema.safeParse({
          targetType: 'invalid_type',
          targetId: validId,
          reason: 'Spam',
        }).success
      ).toBe(false)

      expect(
        createReportSchema.safeParse({
          targetType: 'story',
          targetId: 'invalid-id',
          reason: 'Spam',
        }).success
      ).toBe(false)
    })

    it('rejects reason shorter than 2 characters', () => {
      expect(
        createReportSchema.safeParse({
          targetType: 'story',
          targetId: validId,
          reason: 'A',
        }).success
      ).toBe(false)
    })
  })

  describe('reportActionSchema', () => {
    it('accepts valid report actions', () => {
      const actions = ['dismiss', 'request_revision', 'hide', 'remove', 'warn_user']
      for (const action of actions) {
        const res = reportActionSchema.safeParse({ action, note: 'Ghi chú' })
        expect(res.success).toBe(true)
      }
    })

    it('rejects suspend_user as it belongs to admin only', () => {
      expect(reportActionSchema.safeParse({ action: 'suspend_user' }).success).toBe(false)
    })

    it('rejects unsupported actions', () => {
      expect(reportActionSchema.safeParse({ action: 'unknown_action' }).success).toBe(false)
    })
  })

  describe('addReportNoteSchema', () => {
    it('rejects empty note', () => {
      expect(addReportNoteSchema.safeParse({ note: '' }).success).toBe(false)
      expect(addReportNoteSchema.safeParse({ note: '   ' }).success).toBe(false)
    })

    it('accepts non-empty note', () => {
      expect(addReportNoteSchema.safeParse({ note: 'Đang chờ tác giả phản hồi' }).success).toBe(true)
    })
  })

  describe('historyQuerySchema', () => {
    it('defaults range to all and limit to 20', () => {
      const result = historyQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.range).toBe('all')
        expect(result.data.limit).toBe(20)
      }
    })

    it('accepts valid range values', () => {
      expect(historyQuerySchema.safeParse({ range: '24h' }).success).toBe(true)
      expect(historyQuerySchema.safeParse({ range: '7d' }).success).toBe(true)
      expect(historyQuerySchema.safeParse({ range: '30d' }).success).toBe(true)
    })
  })
})
