import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { validate } from '../../../middlewares/validate.js'
import { storyActionParamSchema, chapterActionParamSchema, commentActionParamSchema } from '../moderation.validation.js'

const id = '6abe6b827523cd816a598051'

describe('Moderation action route validation', () => {
  for (const [schema, actions] of [
    [storyActionParamSchema, ['approve', 'hide', 'remove', 'request_revision']],
    [chapterActionParamSchema, ['approve', 'hide', 'remove']],
    [commentActionParamSchema, ['approve', 'hide', 'delete']],
  ] as const) {
    it.each(actions)('preserves %s for the controller', async action => {
      const req = { params: { id, action } } as unknown as Request
      const next = vi.fn()
      await validate({ params: schema })(req, {} as Response, next)
      expect(next).toHaveBeenCalledWith()
      expect(req.params).toEqual({ id, action })
    })
    it('rejects invalid actions and IDs', () => {
      expect(schema.safeParse({ id, action: 'oldest' }).success).toBe(false)
      expect(schema.safeParse({ id: 'invalid', action: 'approve' }).success).toBe(false)
    })
  }
})
