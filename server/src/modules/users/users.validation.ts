import { z } from 'zod'
import { newPasswordSchema } from '../../common/passwordPolicy.js'

export const updateProfileSchema = z.object({
  displayName: z.string().min(1, 'Tên hiển thị không được để trống').max(50, 'Tên hiển thị tối đa 50 ký tự').optional(),
  bio: z.string().max(500, 'Giới thiệu tối đa 500 ký tự').optional(),
})

// Avatar Base64 Data URI: max ~700KB string length (~500KB raw image)
const BASE64_DATA_URI_REGEX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/
const MAX_AVATAR_BASE64_LENGTH = 750 * 1024 // ~750KB

export const updateAvatarSchema = z.object({
  avatarBase64: z
    .string({ required_error: 'Vui lòng cung cấp chuỗi ảnh Base64' })
    .min(1, 'Chuỗi ảnh không được để trống')
    .max(MAX_AVATAR_BASE64_LENGTH, 'Dung lượng ảnh vượt quá giới hạn cho phép (~500KB)')
    .regex(
      BASE64_DATA_URI_REGEX,
      'Định dạng ảnh không hợp lệ (hỗ trợ PNG, JPEG, WEBP, GIF dạng Data URI)'
    ),
})

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Mật khẩu cũ không được để trống'),
  newPassword: newPasswordSchema,
})

export const changeEmailSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email('Email không hợp lệ').min(1, 'Email không được để trống'),
  oldPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(100),
})

export const publicProfileParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID người dùng không hợp lệ'),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>
