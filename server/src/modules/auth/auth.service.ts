import { userRepository } from '../../repositories/user.repository.js'
import {
  RegisterInput,
  LoginInput,
  ResetPasswordInput,
} from './auth.validation.js'
import { hashPassword, comparePassword } from '../../common/hash.js'
import {
  signAccessToken,
  signEmailVerificationToken,
  signPasswordResetToken,
  verifyToken,
  TokenPayload,
} from '../../common/jwt.js'
import { AppError } from '../../common/AppError.js'
import { redis } from '../../config/redis.js'
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmail,
} from '../../emails/mailer.js'
import { logger } from '../../common/logger.js'
import { startRefreshSession, rotateRefreshSession, revokeRefreshSession } from './refresh-session.js'
import { isAccountLocked, isSessionCurrent } from '../../common/accountState.js'
import { disconnectUserSockets } from '../../config/socket.js'


/** Every login method must register the session that refresh/logout validate. */
export const createSession = async (payload: TokenPayload) => {
  if (redis.status !== 'ready') throw new AppError(503, 'Dịch vụ phiên đăng nhập tạm thời không khả dụng', 'SESSION_UNAVAILABLE')
  const accessToken = signAccessToken(payload)
  const refreshToken = await startRefreshSession(payload)
  return { accessToken, refreshToken }
}

export const register = async (input: RegisterInput) => {
  const existingEmail = await userRepository.findByEmail(input.email)
  if (existingEmail) {
    throw AppError.conflict('Email đã được sử dụng', 'EMAIL_ALREADY_EXISTS')
  }

  const existingUsername = await userRepository.findByUsername(input.username)
  if (existingUsername) {
    throw AppError.conflict('Tên đăng nhập đã được sử dụng', 'USERNAME_ALREADY_EXISTS')
  }

  const hashedPassword = await hashPassword(input.password)

  const user = await userRepository.create({
    email: input.email,
    username: input.username,
    displayName: input.username,
    password: hashedPassword,
    provider: 'local',
    role: 'user',
    isEmailVerified: false,
  })

  // Generate email verification token and send email
  const verifyEmailToken = signEmailVerificationToken({ id: user._id.toString(), email: user.email, authVersion: user.authVersion ?? 0 })
  sendVerificationEmail(user.email, verifyEmailToken).catch((err) => {
    logger.error('Failed to send verification email after registration:', err)
  })

  // Auto-login: generate tokens
  const payload: TokenPayload = {
    id: user._id.toString(),
    role: user.role,
    authVersion: user.authVersion ?? 0,
  }

  const { accessToken, refreshToken } = await createSession(payload)

  logger.info(`User registered and auto-logged in: ${user.email} (${user._id})`)

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      authorStatus: user.authorStatus,
      isEmailVerified: user.isEmailVerified,
    },
  }
}

export const login = async (input: LoginInput) => {
  const user = await userRepository.findByEmail(input.email)
  if (!user || !user.password) {
    throw AppError.unauthorized('Email hoặc mật khẩu không chính xác', 'INVALID_CREDENTIALS')
  }

  const isMatch = await comparePassword(input.password, user.password)
  if (!isMatch) {
    throw AppError.unauthorized('Email hoặc mật khẩu không chính xác', 'INVALID_CREDENTIALS')
  }

  if (isAccountLocked(user)) {
    throw AppError.forbidden(
      user.lockedReason || 'Tài khoản của bạn đã bị khóa',
      'ACCOUNT_LOCKED'
    )
  }

  const payload: TokenPayload = {
    id: user._id.toString(),
    role: user.role,
    authVersion: user.authVersion ?? 0,
  }

  const { accessToken, refreshToken } = await createSession(payload)

  await userRepository.updateLastLogin(user._id.toString())

  // Reissue mailbox-bound links for users holding verification links from older releases.
  if (!user.isEmailVerified) {
    const token = signEmailVerificationToken({ id: user._id.toString(), email: user.email, authVersion: user.authVersion ?? 0 })
    void sendVerificationEmail(user.email, token).catch(error => logger.error('Verification email delivery failed', error))
  }

  logger.info(`User logged in: ${user.email} (${user._id})`)

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      authorStatus: user.authorStatus,
      isEmailVerified: user.isEmailVerified,
    },
  }
}

export const refresh = async (refreshToken: string) => {
  if (!refreshToken) {
    throw AppError.unauthorized('Refresh token is required', 'REFRESH_TOKEN_REQUIRED')
  }

  const payload = verifyToken<TokenPayload>(refreshToken, undefined, true)
  if (payload.type !== 'refresh') {
    throw AppError.unauthorized('Invalid refresh token', 'INVALID_TOKEN')
  }

  const user = await userRepository.findById(payload.id)
  if (!user) {
    throw AppError.unauthorized('User not found', 'USER_NOT_FOUND')
  }

  if (isAccountLocked(user)) {
    throw AppError.forbidden('Tài khoản của bạn đã bị khóa', 'ACCOUNT_LOCKED')
  }

  if (!isSessionCurrent(user, payload)) throw AppError.unauthorized('Phiên đã bị thu hồi', 'TOKEN_REVOKED')
  if (redis.status !== 'ready') throw new AppError(503, 'Dịch vụ phiên đăng nhập tạm thời không khả dụng', 'SESSION_UNAVAILABLE')
  const rotatedRefreshToken = await rotateRefreshSession(payload, refreshToken)

  const newAccessToken = signAccessToken({
    id: user._id.toString(),
    role: user.role,
    authVersion: user.authVersion ?? 0,
  })

  return {
    accessToken: newAccessToken,
    refreshToken: rotatedRefreshToken,
    user: {
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      authorStatus: user.authorStatus,
      isEmailVerified: user.isEmailVerified,
    },
  }
}

export const logout = async (userId: string, refreshToken?: string) => {
  if (refreshToken && redis.status !== 'ready') throw new AppError(503, 'Không thể thu hồi phiên lúc này', 'SESSION_UNAVAILABLE')
  if (redis.status === 'ready' && refreshToken) {
    // An expired/legacy token need not prevent clearing the browser cookie.
    try {
      const payload = verifyToken<TokenPayload>(refreshToken, undefined, true)
      if (payload.type === 'refresh' && payload.id === userId) await revokeRefreshSession(payload)
    } catch (error) {
      if (!(error instanceof AppError) || !['TOKEN_EXPIRED', 'INVALID_TOKEN', 'UNAUTHORIZED'].includes(error.code ?? '')) throw error
    }
  }
  logger.info(`User logged out: ${userId}`)
}

export const verifyEmail = async (token: string) => {
  const payload = verifyToken<TokenPayload>(token)
  if (payload.type !== 'verify_email' && payload.type !== 'change_email') {
    throw AppError.badRequest('Invalid verification token', 'INVALID_TOKEN')
  }

  const user = await userRepository.findById(payload.id)
  if (!user) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND')
  }

  if (typeof payload.email !== 'string' || !Number.isInteger(payload.authVersion) ||
      payload.email !== user.email || payload.authVersion !== (user.authVersion ?? 0) || isAccountLocked(user)) {
    throw AppError.badRequest('Liên kết không còn hợp lệ. Vui lòng yêu cầu lại.', 'INVALID_TOKEN')
  }
  const expected = { email: user.email, authVersion: user.authVersion ?? 0 }
  if (payload.type === 'change_email') {
    if (typeof payload.newEmail !== 'string' || !payload.newEmail || user.provider !== 'local') {
      throw AppError.badRequest('Invalid email change token', 'INVALID_TOKEN')
    }
    const updated = await userRepository.confirmEmailChange(user._id.toString(), payload.newEmail, expected)
    if (!updated) throw AppError.conflict('Thông tin tài khoản đã thay đổi. Vui lòng yêu cầu lại.', 'CREDENTIALS_CHANGED')
    disconnectUserSockets(user._id.toString())
    void sendEmail({ to: user.email, subject: '[Novel Web] Địa chỉ email tài khoản đã thay đổi',
      html: '<p>Địa chỉ đăng nhập và khôi phục của tài khoản đã thay đổi sau khi xác nhận email mới. Nếu bạn không thực hiện, hãy liên hệ bộ phận hỗ trợ.</p>',
    }).catch(error => logger.error('Email change security notice failed', error))
    return updated
  }
  const updatedUser = await userRepository.verifyEmail(user._id.toString(), expected)
  if (!updatedUser) throw AppError.badRequest('Liên kết không còn hợp lệ', 'INVALID_TOKEN')
  logger.info(`Email verified for user: ${user.email} (${user._id})`)
  return updatedUser
}

export const forgotPassword = async (email: string) => {
  const user = await userRepository.findByEmail(email)
  if (!user || user.provider !== 'local') {
    // Return successfully even if user not found to prevent user enumeration
    logger.warn(`Password reset requested for non-existent or OAuth email: ${email}`)
    return
  }

  const resetToken = signPasswordResetToken({ id: user._id.toString(), email: user.email, authVersion: user.authVersion ?? 0 })
  await sendPasswordResetEmail(user.email, resetToken)
  logger.info(`Password reset email sent to: ${email}`)
}

export const resetPassword = async (input: ResetPasswordInput) => {
  const payload = verifyToken<TokenPayload>(input.token)
  if (payload.type !== 'reset_password') {
    throw AppError.badRequest('Invalid password reset token', 'INVALID_TOKEN')
  }

  const user = await userRepository.findById(payload.id)
  if (!user) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND')
  }

  if (user.provider !== 'local' || typeof payload.email !== 'string' || !Number.isInteger(payload.authVersion) ||
      payload.email !== user.email || payload.authVersion !== (user.authVersion ?? 0) || isAccountLocked(user)) {
    throw AppError.badRequest('Liên kết đặt lại mật khẩu không còn hợp lệ', 'INVALID_TOKEN')
  }
  const hashedPassword = await hashPassword(input.newPassword)
  const updated = await userRepository.updatePassword(user._id.toString(), hashedPassword, {
    email: user.email, authVersion: user.authVersion ?? 0,
  })
  if (!updated) throw AppError.badRequest('Liên kết đã được sử dụng hoặc tài khoản đã thay đổi', 'INVALID_TOKEN')
  disconnectUserSockets(user._id.toString())

  logger.info(`Password reset successfully for user: ${user.email} (${user._id})`)
}

export const authService = {
  createSession,
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
}
