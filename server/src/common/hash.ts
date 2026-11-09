import bcrypt from 'bcrypt'
import { AppError } from './AppError.js'

const SALT_ROUNDS = 10

export const hashPassword = async (password: string): Promise<string> => {
  if (Buffer.byteLength(password, 'utf8') > 72) throw AppError.badRequest('Mật khẩu không được vượt quá 72 byte UTF-8', 'PASSWORD_TOO_LONG')
  return bcrypt.hash(password, SALT_ROUNDS)
}

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}
