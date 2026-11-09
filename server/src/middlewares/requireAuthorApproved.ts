import { Request, Response, NextFunction } from 'express'
import { AppError } from '../common/AppError.js'

export const requireAuthorApproved = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(AppError.unauthorized('Vui lòng đăng nhập', 'UNAUTHORIZED'))
  }

  // Admin and Moderator are privileged
  if (['admin', 'moderator'].includes(req.user.role)) {
    return next()
  }

  if (req.user.role !== 'author' || req.user.authorStatus !== 'approved') {
    return next(
      AppError.forbidden(
        'Tài khoản tác giả của bạn chưa được duyệt hoặc đã bị thu hồi',
        'AUTHOR_NOT_APPROVED'
      )
    )
  }

  next()
}
