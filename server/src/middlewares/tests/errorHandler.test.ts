import { describe, it, expect, vi } from 'vitest'
import { Request, Response } from 'express'
import { ZodError, ZodIssue } from 'zod'
import { errorHandler } from '../errorHandler.js'
import { AppError } from '../../common/AppError.js'

describe('errorHandler Middleware', () => {
  const createMockReqRes = () => {
    const req = {
      id: 'req-test-123',
      path: '/api/v1/test',
      method: 'GET',
    } as unknown as Request

    const jsonMock = vi.fn()
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock })
    const res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response

    const next = vi.fn()

    return { req, res, statusMock, jsonMock, next }
  }

  it('should handle AppError correctly with statusCode and payload', () => {
    const { req, res, statusMock, jsonMock, next } = createMockReqRes()
    const appError = AppError.badRequest('Invalid parameter', 'INVALID_PARAM', [
      { field: 'title', message: 'Title is required' },
    ])

    errorHandler(appError, req, res, next)

    expect(statusMock).toHaveBeenCalledWith(400)
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid parameter',
      code: 'INVALID_PARAM',
      errors: [{ field: 'title', message: 'Title is required' }],
    })
  })

  it('should handle AppError unauthorized correctly', () => {
    const { req, res, statusMock, jsonMock, next } = createMockReqRes()
    const appError = AppError.unauthorized('Token expired')

    errorHandler(appError, req, res, next)

    expect(statusMock).toHaveBeenCalledWith(401)
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: 'Token expired',
      code: 'UNAUTHORIZED',
    })
  })

  it('should handle ZodError and convert to 400 response with issues formatted', () => {
    const { req, res, statusMock, jsonMock, next } = createMockReqRes()
    const issues: ZodIssue[] = [
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['email'],
        message: 'Email is required',
      },
    ]
    const zodError = new ZodError(issues)

    errorHandler(zodError, req, res, next)

    expect(statusMock).toHaveBeenCalledWith(400)
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'email', message: 'Email is required' }],
    })
  })

  it('should handle unexpected errors as 500 INTERNAL_ERROR', () => {
    const { req, res, statusMock, jsonMock, next } = createMockReqRes()
    const genericError = new Error('Database connection failed')

    errorHandler(genericError, req, res, next)

    expect(statusMock).toHaveBeenCalledWith(500)
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      })
    )
  })
})
