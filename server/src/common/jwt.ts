import jwt, { type SignOptions, type VerifyOptions } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AppError } from './AppError.js'

export const getPrivateKey = (refresh = false): string => {
  const key = refresh ? env.JWT_REFRESH_PRIVATE_KEY || env.JWT_PRIVATE_KEY : env.JWT_PRIVATE_KEY
  if (key.includes('BEGIN PRIVATE KEY') || key.includes('BEGIN RSA PRIVATE KEY')) {
    return key
  }
  return Buffer.from(key, 'base64').toString('utf-8')
}

export const getPublicKey = (refresh = false): string => {
  const key = refresh ? env.JWT_REFRESH_PUBLIC_KEY || env.JWT_PUBLIC_KEY : env.JWT_PUBLIC_KEY
  if (key.includes('BEGIN PUBLIC KEY') || key.includes('BEGIN RSA PUBLIC KEY')) {
    return key
  }
  return Buffer.from(key, 'base64').toString('utf-8')
}

export interface TokenPayload {
  id: string
  role?: string
  tokenVersion?: number
  authVersion?: number
  type?: 'access' | 'refresh' | 'verify_email' | 'reset_password' | 'change_email'
  [key: string]: any
}

export const signAccessToken = (payload: TokenPayload, options?: SignOptions): string => {
  return jwt.sign({ ...payload, type: 'access' }, getPrivateKey(), {
    algorithm: 'RS256',
    expiresIn: '15m',
    ...options,
  })
}

export const signRefreshToken = (payload: TokenPayload, options?: SignOptions): string => {
  return jwt.sign({ ...payload, type: 'refresh' }, getPrivateKey(true), {
    algorithm: 'RS256',
    expiresIn: '7d',
    ...options,
  })
}

export const signEmailVerificationToken = (payload: TokenPayload, options?: SignOptions): string => {
  return jwt.sign({ ...payload, type: 'verify_email' }, getPrivateKey(), {
    algorithm: 'RS256',
    expiresIn: '24h',
    ...options,
  })
}

export const signPasswordResetToken = (payload: TokenPayload, options?: SignOptions): string => {
  return jwt.sign({ ...payload, type: 'reset_password' }, getPrivateKey(), {
    algorithm: 'RS256',
    expiresIn: '1h',
    ...options,
  })
}

export const signEmailChangeToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, type: 'change_email' }, getPrivateKey(), {
    algorithm: 'RS256', expiresIn: '30m',
  })
}

export const verifyToken = <T extends object = TokenPayload>(
  token: string,
  options?: VerifyOptions,
  refresh = false
): T => {
  try {
    return jwt.verify(token, getPublicKey(refresh), {
      algorithms: ['RS256'],
      ...options,
    }) as T
  } catch (error: any) {
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Token has expired', 'TOKEN_EXPIRED')
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw AppError.unauthorized('Invalid token', 'INVALID_TOKEN')
    }
    throw AppError.unauthorized('Token verification failed', 'UNAUTHORIZED')
  }
}
