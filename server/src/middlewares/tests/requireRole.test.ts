import { describe, it, expect, vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { requireRole } from '../requireRole.js'
import { AppError } from '../../common/AppError.js'

describe('requireRole Middleware', () => {
  it('should call next() if user role is in allowed roles', () => {
    const req = {
      user: { role: 'admin' },
    } as unknown as Request
    const res = {} as unknown as Response
    const next: NextFunction = vi.fn()

    const middleware = requireRole(['admin', 'author'])
    middleware(req, res, next)

    expect(next).toHaveBeenCalledWith()
  })

  it('should pass AppError.unauthorized if req.user is missing', () => {
    const req = {} as unknown as Request
    const res = {} as unknown as Response
    const next: NextFunction = vi.fn()

    const middleware = requireRole(['admin'])
    middleware(req, res, next)

    const error = (next as any).mock.calls[0][0]
    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(401)
  })

  it('should pass AppError.forbidden if user role is not allowed', () => {
    const req = {
      user: { role: 'user' },
    } as unknown as Request
    const res = {} as unknown as Response
    const next: NextFunction = vi.fn()

    const middleware = requireRole(['admin', 'moderator'])
    middleware(req, res, next)

    const error = (next as any).mock.calls[0][0]
    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(403)
    expect(error.code).toBe('FORBIDDEN')
  })
})
