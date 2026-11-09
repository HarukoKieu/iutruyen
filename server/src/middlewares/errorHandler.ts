import { Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../common/AppError.js'
import { env } from '../config/env.js'
import { logger } from '../common/logger.js'

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if ('code' in err && err.code === 11000) {
    res.status(409).json({ success: false, message: 'Dữ liệu hoặc thứ tự đã tồn tại. Vui lòng tải lại và thử lại.', code: 'DUPLICATE_RESOURCE' })
    return
  }
  // 1. AppError (Custom operational errors)
  if (err instanceof AppError) {
    if ((err.statusCode === 429 || err.statusCode === 503) && Number.isFinite(err.retryAfterSeconds)) {
      res.setHeader('Retry-After', String(Math.max(1, Math.min(3600, Math.ceil(err.retryAfterSeconds!)))))
    }
    const payload: {
      success: boolean
      message: string
      code?: string
      errors?: any[]
    } = {
      success: false,
      message: err.message,
    }

    if (err.code) payload.code = err.code
    if (err.errors && err.errors.length > 0) payload.errors = err.errors

    res.status(err.statusCode).json(payload)
    return
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }))

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors,
    })
    return
  }

  // 3. Unhandled Internal Server Error (500)
  logger.error('Unhandled Server Error', {
    message: err.message,
    stack: err.stack,
    requestId: req.id,
    path: req.path,
    method: req.method,
  })

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  })
}
