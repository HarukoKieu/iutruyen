export interface ValidationErrorItem {
  field: string
  message: string
}

export class AppError extends Error {
  public statusCode: number
  public code?: string
  public errors?: ValidationErrorItem[]
  public retryAfterSeconds?: number

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    errors?: ValidationErrorItem[]
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.errors = errors
    Object.setPrototypeOf(this, AppError.prototype)
  }

  static badRequest(
    message: string,
    code = 'BAD_REQUEST',
    errors?: ValidationErrorItem[]
  ): AppError {
    return new AppError(400, message, code, errors)
  }

  static unauthorized(
    message = 'Unauthorized access',
    code = 'UNAUTHORIZED'
  ): AppError {
    return new AppError(401, message, code)
  }

  static forbidden(
    message = 'Access forbidden',
    code = 'FORBIDDEN'
  ): AppError {
    return new AppError(403, message, code)
  }

  static notFound(
    message = 'Resource not found',
    code = 'NOT_FOUND'
  ): AppError {
    return new AppError(404, message, code)
  }

  static conflict(
    message: string,
    code = 'CONFLICT'
  ): AppError {
    return new AppError(409, message, code)
  }

  static tooManyRequests(
    message = 'Too many requests, please try again later',
    code = 'TOO_MANY_REQUESTS'
  ): AppError {
    return new AppError(429, message, code)
  }
}
