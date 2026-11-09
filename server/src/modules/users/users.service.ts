import { userRepository } from '../../repositories/user.repository.js'
import {
  UpdateProfileInput,
  ChangePasswordInput,
  ChangeEmailInput,
} from './users.validation.js'
import { comparePassword, hashPassword } from '../../common/hash.js'
import { AppError } from '../../common/AppError.js'
import { signEmailChangeToken } from '../../common/jwt.js'
import { sendVerificationEmail } from '../../emails/mailer.js'
import { logger } from '../../common/logger.js'
import { disconnectUserSockets, emitToModerators } from '../../config/socket.js'

export const getMe = async (userId: string) => {
  const user = await userRepository.findById(userId)
  if (!user) {
    throw AppError.notFound('Người dùng không tồn tại', 'USER_NOT_FOUND')
  }
  return user
}

export const updateMe = async (userId: string, input: UpdateProfileInput) => {
  const user = await userRepository.updateById(userId, input)
  if (!user) {
    throw AppError.notFound('Người dùng không tồn tại', 'USER_NOT_FOUND')
  }
  logger.info(`Profile updated for user: ${userId}`)
  return user
}

export const updateAvatar = async (userId: string, avatarBase64: string) => {
  const user = await userRepository.updateAvatar(userId, avatarBase64)
  if (!user) {
    throw AppError.notFound('Người dùng không tồn tại', 'USER_NOT_FOUND')
  }
  logger.info(`Avatar updated for user: ${userId}`)
  return user
}

export const changePassword = async (userId: string, input: ChangePasswordInput) => {
  const user = await userRepository.findById(userId)
  if (!user) {
    throw AppError.notFound('Người dùng không tồn tại', 'USER_NOT_FOUND')
  }

  if (!user.password) {
    throw AppError.badRequest(
      'Tài khoản đăng nhập bằng mạng xã hội, vui lòng dùng chức năng quên mật khẩu để tạo mật khẩu',
      'OAUTH_USER_NO_PASSWORD'
    )
  }

  const isMatch = await comparePassword(input.oldPassword, user.password)
  if (!isMatch) {
    throw AppError.badRequest('Mật khẩu hiện tại không chính xác', 'INVALID_OLD_PASSWORD')
  }

  const hashedPassword = await hashPassword(input.newPassword)
  const updated = await userRepository.updatePassword(userId, hashedPassword, {
    email: user.email, authVersion: user.authVersion ?? 0,
  })
  if (!updated) throw AppError.conflict('Thông tin tài khoản đã thay đổi. Vui lòng đăng nhập lại.', 'CREDENTIALS_CHANGED')
  disconnectUserSockets(userId)
  logger.info(`Password changed for user: ${userId}`)
}

export const changeEmail = async (userId: string, input: ChangeEmailInput) => {
  const user = await userRepository.findById(userId)
  if (!user) throw AppError.notFound('Người dùng không tồn tại', 'USER_NOT_FOUND')
  if (user.provider !== 'local' || !user.password) {
    throw AppError.badRequest('Tài khoản Google cần quản lý email qua nhà cung cấp đăng nhập.', 'OAUTH_EMAIL_CHANGE_UNSUPPORTED')
  }
  if (!await comparePassword(input.oldPassword, user.password)) {
    throw AppError.badRequest('Mật khẩu hiện tại không chính xác', 'INVALID_OLD_PASSWORD')
  }
  if (user.email === input.newEmail) throw AppError.badRequest('Email mới trùng email hiện tại', 'EMAIL_UNCHANGED')
  const existing = await userRepository.findByEmail(input.newEmail)
  if (existing && existing._id.toString() !== userId) {
    throw AppError.conflict('Email này đã được sử dụng bởi tài khoản khác', 'EMAIL_ALREADY_EXISTS')
  }

  const token = signEmailChangeToken({
    id: userId, email: user.email, newEmail: input.newEmail, authVersion: user.authVersion ?? 0,
  })
  if (!await sendVerificationEmail(input.newEmail, token, true)) {
    throw new AppError(503, 'Chưa gửi được email xác nhận. Vui lòng thử lại.', 'EMAIL_UNAVAILABLE')
  }
  logger.info(`Email change confirmation requested for user: ${userId}`)
  return user
}

export const becomeAuthor = async (userId: string) => {
  const user = await userRepository.findById(userId)
  if (!user) {
    throw AppError.notFound('Người dùng không tồn tại', 'USER_NOT_FOUND')
  }

  if (user.role === 'author') {
    throw AppError.badRequest('Bạn đã là tác giả', 'ALREADY_AUTHOR')
  }

  if (user.authorStatus === 'pending') {
    throw AppError.badRequest(
      'Yêu cầu đăng ký làm tác giả của bạn đang chờ Admin duyệt',
      'AUTHOR_REQUEST_PENDING'
    )
  }

  const updatedUser = await userRepository.updateById(userId, {
    authorStatus: 'pending',
  })

  logger.info(`User ${userId} requested to become author`)

  try {
    emitToModerators('moderation:new_author_request', {
      userId: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      createdAt: new Date(),
    })
    emitToModerators('moderation:queue_updated', {
      type: 'author_request',
      userId: user._id.toString(),
    })
  } catch (err) {
    logger.warn('Failed to emit moderation:new_author_request socket event:', err)
  }

  return updatedUser
}

export const getPublicProfile = async (id: string) => {
  const profile = await userRepository.findPublicProfile(id)
  if (!profile) {
    throw AppError.notFound('Người dùng không tồn tại', 'USER_NOT_FOUND')
  }
  return profile
}

export const usersService = {
  getMe,
  updateMe,
  updateAvatar,
  changePassword,
  changeEmail,
  becomeAuthor,
  getPublicProfile,
}
