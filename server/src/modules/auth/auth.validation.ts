import { z } from 'zod'
import { newPasswordSchema } from '../../common/passwordPolicy.js'

export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ').min(1, 'Email không được để trống'),
  username: z
    .string()
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .max(30, 'Tên đăng nhập không quá 30 ký tự')
    .regex(/^[a-zA-Z0-9_]+$/, 'Tên đăng nhập chỉ chứa chữ cái, số và dấu gạch dưới'),
  password: newPasswordSchema,
})

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ').min(1, 'Email không được để trống'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
})

export const verifyEmailSchema = z
  .object({
    code: z.string().optional(),
    token: z.string().optional(),
  })
  .refine((data) => (data.code && data.code.trim().length > 0) || (data.token && data.token.trim().length > 0), {
    message: 'Vui lòng nhập mã code hoặc token xác thực',
    path: ['code'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ').min(1, 'Email không được để trống'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token không được để trống'),
  newPassword: newPasswordSchema,
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
