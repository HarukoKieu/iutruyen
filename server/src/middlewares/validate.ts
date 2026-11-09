import { Request, Response, NextFunction } from 'express'
import { ZodTypeAny, ZodError } from 'zod'
import { AppError } from '../common/AppError.js'

interface RequestValidators {
  body?: ZodTypeAny
  query?: ZodTypeAny
  params?: ZodTypeAny
}

export const validate = (schemas: RequestValidators) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body)
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query)
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params)
      }
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))
        next(AppError.badRequest('Validation failed', 'VALIDATION_ERROR', errors))
      } else {
        next(error)
      }
    }
  }
}
