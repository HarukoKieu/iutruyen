import { Request, Response, NextFunction } from 'express'
import { AppError } from '../common/AppError.js'

export const requireOwnership = (
  getResourceOwnerId: (req: Request) => Promise<string | null | undefined>
) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(AppError.unauthorized('Vui lòng đăng nhập', 'UNAUTHORIZED'))
      }

      // Privileged roles can bypass ownership check
      if (['admin', 'moderator'].includes(req.user.role)) {
        return next()
      }

      const ownerId = await getResourceOwnerId(req)
      if (!ownerId) {
        return next(AppError.notFound('Tài nguyên không tồn tại', 'NOT_FOUND'))
      }

      if (req.user.id !== ownerId.toString()) {
        return next(
          AppError.forbidden('Bạn không sở hữu tài nguyên này', 'FORBIDDEN')
        )
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
