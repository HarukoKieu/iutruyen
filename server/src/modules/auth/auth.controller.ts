import { Request, Response } from 'express'
import { authService } from './auth.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'
import { env } from '../../config/env.js'

const REFRESH_COOKIE_NAME = 'refreshToken'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

export const setRefreshTokenCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost' ? env.COOKIE_DOMAIN : undefined,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== 'localhost' ? env.COOKIE_DOMAIN : undefined,
    path: '/',
  })
}

export const register = async (req: Request, res: Response): Promise<void> => {
  const { accessToken, refreshToken, user } = await authService.register(req.body)
  setRefreshTokenCookie(res, refreshToken)
  ApiResponse.created(
    res,
    { accessToken, user },
    'Đăng ký tài khoản thành công!'
  )
}

export const login = async (req: Request, res: Response): Promise<void> => {
  const { accessToken, refreshToken, user } = await authService.login(req.body)
  setRefreshTokenCookie(res, refreshToken)
  ApiResponse.success(res, { accessToken, user }, { message: 'Đăng nhập thành công' })
}

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies[REFRESH_COOKIE_NAME]
  const { accessToken, refreshToken: rotated, user } = await authService.refresh(refreshToken)
  setRefreshTokenCookie(res, rotated)
  ApiResponse.success(res, { accessToken, user })
}

export const logout = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies[REFRESH_COOKIE_NAME]
  if (req.user) {
    await authService.logout(req.user.id, refreshToken)
  }
  clearRefreshTokenCookie(res)
  ApiResponse.success(res, null, { message: 'Đăng xuất thành công' })
}

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const token = (req.body.token && req.body.token.trim()) || (req.body.code && req.body.code.trim())
  await authService.verifyEmail(token)
  ApiResponse.success(res, null, { message: 'Xác thực email thành công' })
}

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  await authService.forgotPassword(req.body.email)
  ApiResponse.success(res, null, {
    message: 'Nếu email tồn tại trên hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến bạn.',
  })
}

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  await authService.resetPassword(req.body)
  ApiResponse.success(res, null, { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' })
}

export const oauthCallback = async (req: Request, res: Response): Promise<void> => {
  const user = req.user
  if (!user) {
    return res.redirect(`${env.CLIENT_URL}/login?error=oauth_failed`)
  }
  if (user.isLocked) return res.redirect(`${env.CLIENT_URL}/login?error=account_locked`)

  const payload = {
    id: user.id,
    role: user.role,
    authVersion: user.authVersion ?? 0,
  }

  const { refreshToken } = await authService.createSession(payload)

  setRefreshTokenCookie(res, refreshToken)

  // Bootstrap the in-memory access token through the HttpOnly refresh cookie.
  res.redirect(`${env.CLIENT_URL}/oauth-callback`)
}

export const authController = {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  oauthCallback,
}
