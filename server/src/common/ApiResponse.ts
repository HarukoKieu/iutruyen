import { Response } from 'express'
import { CursorPaginationMeta } from './pagination.js'

export interface SuccessOptions {
  message?: string
  meta?: CursorPaginationMeta | Record<string, any>
  statusCode?: number
}

export class ApiResponse {
  static success<T>(res: Response, data: T, options?: SuccessOptions): Response {
    const statusCode = options?.statusCode || 200
    const payload: {
      success: boolean
      data: T
      message?: string
      meta?: CursorPaginationMeta | Record<string, any>
    } = {
      success: true,
      data,
    }

    if (options?.message) {
      payload.message = options.message
    }

    if (options?.meta) {
      payload.meta = options.meta
    }

    return res.status(statusCode).json(payload)
  }

  static created<T>(res: Response, data: T, message = 'Resource created successfully'): Response {
    return ApiResponse.success(res, data, {
      statusCode: 201,
      message,
    })
  }
}
