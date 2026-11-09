import { Request, Response, NextFunction } from 'express'
import { AppError } from '../common/AppError.js'
import { UserRole } from '../models/User.model.js'

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Vui lòng đăng nhập', 'UNAUTHORIZED'))
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden('Bạn không có quyền thực hiện hành động này', 'FORBIDDEN')
      )
    }

    next()
  }
}
