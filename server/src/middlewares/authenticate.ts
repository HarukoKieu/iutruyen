import { Request, Response, NextFunction } from 'express'
import passport from 'passport'
import { AppError } from '../common/AppError.js'
import { UserRole, AuthorStatus } from '../models/User.model.js'

export interface AuthUser {
  id: string
  email: string
  username: string
  displayName: string
  role: UserRole
  authorStatus?: AuthorStatus
  isEmailVerified: boolean
  isLocked: boolean
  authVersion?: number
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  passport.authenticate('jwt', { session: false }, (err: any, user: AuthUser | false, info: any) => {
    if (err) {
      return next(err)
    }

    if (!user) {
      if (info?.name === 'TokenExpiredError') {
        return next(AppError.unauthorized('Token has expired', 'TOKEN_EXPIRED'))
      }
      if (info?.name === 'JsonWebTokenError') {
        return next(AppError.unauthorized('Invalid token', 'INVALID_TOKEN'))
      }
      const message = info?.message || 'Authentication token is required'
      return next(AppError.unauthorized(message, 'UNAUTHORIZED'))
    }

    if (user.isLocked) {
      return next(AppError.forbidden('Tài khoản của bạn đã bị khóa', 'ACCOUNT_LOCKED'))
    }

    req.user = user
    next()
  })(req, res, next)
}

export const optionalAuthenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }

  passport.authenticate('jwt', { session: false }, (_err: any, user: AuthUser | false) => {
    if (user && !user.isLocked) {
      req.user = user
    }
    next()
  })(req, res, next)
}

