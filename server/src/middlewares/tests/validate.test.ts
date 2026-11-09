import { describe, it, expect, vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { validate } from '../validate.js'
import { AppError } from '../../common/AppError.js'

describe('validate Middleware', () => {
  const schema = {
    body: z.object({
      title: z.string().min(3, 'Title must be at least 3 chars'),
      age: z.number().optional(),
    }),
  }

  it('should call next() without error if body matches schema', async () => {
    const req = {
      body: { title: 'Valid Story Title', age: 20 },
      query: {},
      params: {},
    } as unknown as Request
    const res = {} as unknown as Response
    const next: NextFunction = vi.fn()

    const middleware = validate(schema)
    await middleware(req, res, next)

    expect(next).toHaveBeenCalledWith()
    expect(req.body.title).toBe('Valid Story Title')
  })

  it('should pass AppError.badRequest to next() if validation fails', async () => {
    const req = {
      body: { title: 'ab' }, // Too short
      query: {},
      params: {},
    } as unknown as Request
    const res = {} as unknown as Response
    const next: NextFunction = vi.fn()

    const middleware = validate(schema)
    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    const errorPassed = (next as any).mock.calls[0][0]
    expect(errorPassed).toBeInstanceOf(AppError)
    expect(errorPassed.statusCode).toBe(400)
    expect(errorPassed.code).toBe('VALIDATION_ERROR')
    expect(errorPassed.errors).toBeDefined()
    expect(errorPassed.errors[0].field).toBe('title')
  })
})
