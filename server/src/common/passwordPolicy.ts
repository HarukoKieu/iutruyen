import { z } from 'zod'

/** bcrypt counts UTF-8 bytes, not JavaScript characters. Never silently truncate. */
export const newPasswordSchema = z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
  .max(100, 'Mật khẩu quá dài')
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Mật khẩu không được vượt quá 72 byte UTF-8')
