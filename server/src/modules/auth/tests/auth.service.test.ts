import { describe, it, expect, vi, beforeEach } from 'vitest'
import { register, login, refresh } from '../auth.service.js'
import { userRepository } from '../../../repositories/user.repository.js'
import * as hashModule from '../../../common/hash.js'
import * as jwtModule from '../../../common/jwt.js'
import { AppError } from '../../../common/AppError.js'

// Mock dependencies
vi.mock('../../../repositories/user.repository.js', () => ({
  userRepository: {
    findByEmail: vi.fn(),
    findByUsername: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    updateLastLogin: vi.fn(),
  },
}))

vi.mock('../../../config/redis.js', () => ({
  redis: {
    status: 'ready',
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}))

vi.mock('../../../emails/mailer.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}))

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('register', () => {
    it('should throw conflict if email is already taken', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({ _id: '1' } as any)

      await expect(
        register({
          email: 'test@example.com',
          username: 'testuser',
          password: 'Password123!',
        })
      ).rejects.toThrowError(AppError)
    })

    it('should throw conflict if username is already taken', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null)
      vi.mocked(userRepository.findByUsername).mockResolvedValue({ _id: '2' } as any)

      await expect(
        register({
          email: 'test@example.com',
          username: 'testuser',
          password: 'Password123!',
        })
      ).rejects.toThrowError(AppError)
    })

    it('should successfully register a new user and return tokens', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null)
      vi.mocked(userRepository.findByUsername).mockResolvedValue(null)
      vi.spyOn(hashModule, 'hashPassword').mockResolvedValue('hashed_pwd')

      const fakeUser = {
        _id: { toString: () => 'user-123' },
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'testuser',
        role: 'user',
        avatarUrl: undefined,
        authorStatus: 'none',
        isEmailVerified: false,
      }
      vi.mocked(userRepository.create).mockResolvedValue(fakeUser as any)
      vi.spyOn(jwtModule, 'signAccessToken').mockReturnValue('mock_access_token')
      vi.spyOn(jwtModule, 'signRefreshToken').mockReturnValue('mock_refresh_token')
      vi.spyOn(jwtModule, 'signEmailVerificationToken').mockReturnValue('mock_verify_token')

      const result = await register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123!',
      })

      expect(result.accessToken).toBe('mock_access_token')
      expect(result.refreshToken).toBe('mock_refresh_token')
      expect(result.user.email).toBe('test@example.com')
      expect(result.user.username).toBe('testuser')
    })
  })

  describe('login', () => {
    it('should throw unauthorized if user is not found', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null)

      await expect(
        login({
          email: 'notfound@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrowError(AppError)
    })

    it('should throw unauthorized if password does not match', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        _id: 'user-1',
        password: 'hashed_pwd',
      } as any)
      vi.spyOn(hashModule, 'comparePassword').mockResolvedValue(false)

      await expect(
        login({
          email: 'test@example.com',
          password: 'WrongPassword!',
        })
      ).rejects.toThrowError(AppError)
    })

    it('should throw forbidden if user account is locked', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        _id: { toString: () => 'user-1' },
        password: 'hashed_pwd',
        isLocked: true,
        lockedReason: 'Vi phạm quy chuẩn cộng đồng',
      } as any)
      vi.spyOn(hashModule, 'comparePassword').mockResolvedValue(true)

      await expect(
        login({
          email: 'locked@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrowError(AppError)
    })

    it('should login successfully and update lastLogin', async () => {
      const fakeUser = {
        _id: { toString: () => 'user-1' },
        email: 'valid@example.com',
        username: 'validuser',
        displayName: 'Valid User',
        role: 'user',
        password: 'hashed_pwd',
        isLocked: false,
        avatarUrl: undefined,
        authorStatus: 'approved',
        isEmailVerified: true,
      }
      vi.mocked(userRepository.findByEmail).mockResolvedValue(fakeUser as any)
      vi.spyOn(hashModule, 'comparePassword').mockResolvedValue(true)
      vi.spyOn(jwtModule, 'signAccessToken').mockReturnValue('new_access_token')
      vi.spyOn(jwtModule, 'signRefreshToken').mockReturnValue('new_refresh_token')

      const result = await login({
        email: 'valid@example.com',
        password: 'Password123!',
      })

      expect(result.accessToken).toBe('new_access_token')
      expect(result.user.displayName).toBe('Valid User')
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith('user-1')
    })
  })
})
