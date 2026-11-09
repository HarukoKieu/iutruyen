import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import passport from 'passport'
import { redis } from '../../../config/redis.js'
import { env } from '../../../config/env.js'
import { AppError } from '../../../common/AppError.js'

const cookieName = 'googleOAuthState'
const cookieOptions = () => ({ httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/v1/auth/google' })
const validState = (state: unknown): state is string => typeof state === 'string' && /^[a-f0-9]{64}$/.test(state)

/** Browser-bound, server-consumed state; no server session middleware is needed. */
export async function beginGoogleOAuth(req: Request, res: Response, next: NextFunction) {
  if (redis.status !== 'ready') throw new AppError(503, 'Dịch vụ đăng nhập tạm thời không khả dụng', 'SESSION_UNAVAILABLE')
  const state = randomBytes(32).toString('hex')
  await redis.set(`oauth:google:state:${state}`, 'valid', 'EX', 600)
  res.cookie(cookieName, state, { ...cookieOptions(), maxAge: 600000 })
  passport.authenticate('google', { scope: ['profile', 'email'], session: false, state })(req, res, next)
}

/** Reject unsolicited, cross-browser and replayed callbacks before any token exchange. */
export async function verifyGoogleOAuthState(req: Request, res: Response, next: NextFunction) {
  const state = req.query.state, cookie = req.cookies?.[cookieName]
  res.clearCookie(cookieName, cookieOptions())
  if (!validState(state) || !validState(cookie) || !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))) {
    throw AppError.unauthorized('Phiên đăng nhập Google không hợp lệ. Vui lòng bắt đầu lại.', 'OAUTH_STATE_INVALID')
  }
  if (redis.status !== 'ready') throw new AppError(503, 'Dịch vụ đăng nhập tạm thời không khả dụng', 'SESSION_UNAVAILABLE')
  if (await redis.getdel(`oauth:google:state:${state}`) !== 'valid') {
    throw AppError.unauthorized('Phiên đăng nhập Google đã hết hạn hoặc đã dùng', 'OAUTH_STATE_INVALID')
  }
  next()
}
