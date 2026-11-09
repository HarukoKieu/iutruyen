import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IUser } from '../../../models/User.model.js'

vi.mock('../../../config/env.js', async () => {
  const { generateKeyPairSync } = await import('node:crypto')
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  return { env: { JWT_PRIVATE_KEY: keys.privateKey, JWT_PUBLIC_KEY: keys.publicKey } }
})
vi.mock('../../../config/socket.js', () => ({ disconnectUserSockets: vi.fn() }))
vi.mock('../../../common/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('../../../config/redis.js', () => ({ redis: { status: 'ready', get: vi.fn(async () => 'valid') } }))
vi.mock('../../../emails/mailer.js', () => ({ sendVerificationEmail: vi.fn(async () => true), sendPasswordResetEmail: vi.fn(async () => true), sendEmail: vi.fn(async () => true) }))
vi.mock('../../../repositories/user.repository.js', () => ({ userRepository: {
  findById: vi.fn(), findByEmail: vi.fn(), updatePassword: vi.fn(), verifyEmail: vi.fn(), confirmEmailChange: vi.fn(),
} }))
import { userRepository } from '../../../repositories/user.repository.js'
import { hashPassword, comparePassword } from '../../../common/hash.js'
import { signPasswordResetToken, signEmailVerificationToken, signRefreshToken, verifyToken } from '../../../common/jwt.js'
import { resetPassword, verifyEmail, refresh } from '../auth.service.js'
import { changePassword, changeEmail } from '../../users/users.service.js'
import { sendVerificationEmail } from '../../../emails/mailer.js'
import { disconnectUserSockets } from '../../../config/socket.js'
import { changeEmailSchema } from '../../users/users.validation.js'
import { isSessionCurrent } from '../../../common/accountState.js'

let account: IUser
beforeEach(async () => {
  vi.clearAllMocks()
  account = { _id: '507f1f77bcf86cd799439011', email: 'old@example.test', password: await hashPassword('Original123!'), provider: 'local', role: 'user', authVersion: 0, isEmailVerified: false } as unknown as IUser
  vi.mocked(userRepository.findById).mockImplementation(async () => ({ ...account }) as IUser)
  vi.mocked(userRepository.findByEmail).mockResolvedValue(null)
  // Atomic in-memory persistence boundary; Mongo filter is covered separately.
  vi.mocked(userRepository.updatePassword).mockImplementation(async (_id, password, expected) => {
    if (expected.authVersion !== account.authVersion || expected.email !== account.email) return null
    account = { ...account, password, authVersion: account.authVersion + 1 } as IUser
    return account
  })
  vi.mocked(userRepository.confirmEmailChange).mockImplementation(async (_id, email, expected) => {
    if (expected.authVersion !== account.authVersion || expected.email !== account.email) return null
    account = { ...account, email, isEmailVerified: true, authVersion: account.authVersion + 1 } as IUser
    return account
  })
  vi.mocked(userRepository.verifyEmail).mockImplementation(async (_id, expected) => {
    if (expected.authVersion !== account.authVersion || expected.email !== account.email) return null
    account.isEmailVerified = true
    return account
  })
  vi.mocked(sendVerificationEmail).mockResolvedValue(true)
})

describe('credential recovery invariants', () => {
  const resetLink = () => signPasswordResetToken({ id: String(account._id), email: account.email, authVersion: account.authVersion })
  it('revokes old access epochs and persisted refresh sessions after password change', async () => {
    const old = signRefreshToken({ id: String(account._id), authVersion: 0 })
    await changePassword(String(account._id), { oldPassword: 'Original123!', newPassword: 'Changed123!' })
    expect(isSessionCurrent(account, { authVersion: 0 })).toBe(false)
    await expect(refresh(old)).rejects.toMatchObject({ code: 'TOKEN_REVOKED' })
    expect(await comparePassword('Changed123!', account.password!)).toBe(true)
    expect(disconnectUserSockets).toHaveBeenCalledWith(String(account._id))
  })
  it('allows only one concurrent reset and rejects replay', async () => {
    const token = resetLink()
    const result = await Promise.allSettled(['First123!', 'Second123!'].map(newPassword => resetPassword({ token, newPassword })))
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(account.authVersion).toBe(1)
    await expect(resetPassword({ token, newPassword: 'Replay123!' })).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
  })
  it('rejects legacy unbound, expired and wrong-purpose reset tokens without writes', async () => {
    const payload = { id: String(account._id), email: account.email, authVersion: 0 }
    for (const token of [signPasswordResetToken({ id: payload.id }), signPasswordResetToken(payload, { expiresIn: -1 }), signEmailVerificationToken(payload)]) {
      await expect(resetPassword({ token, newPassword: 'Replay123!' })).rejects.toThrow()
    }
    expect(userRepository.updatePassword).not.toHaveBeenCalled()
  })
  it('requires the current password and keeps the old mailbox until confirmation', async () => {
    expect(changeEmailSchema.safeParse({ newEmail: 'new@example.test' }).success).toBe(false)
    await expect(changeEmail(String(account._id), { newEmail: 'new@example.test', oldPassword: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_OLD_PASSWORD' })
    await changeEmail(String(account._id), { newEmail: 'new@example.test', oldPassword: 'Original123!' })
    expect(account.email).toBe('old@example.test')
    const token = vi.mocked(sendVerificationEmail).mock.calls[0][1]
    expect(verifyToken(token)).toMatchObject({ type: 'change_email', email: 'old@example.test', newEmail: 'new@example.test' })
    await verifyEmail(token)
    expect(account).toMatchObject({ email: 'new@example.test', isEmailVerified: true, authVersion: 1 })
    await expect(verifyEmail(token)).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
  })
  it('invalidates pending mailbox/reset links after a credential change', async () => {
    const reset = resetLink()
    await changeEmail(String(account._id), { newEmail: 'new@example.test', oldPassword: 'Original123!' })
    const pending = vi.mocked(sendVerificationEmail).mock.calls[0][1]
    await changePassword(String(account._id), { oldPassword: 'Original123!', newPassword: 'Changed123!' })
    await expect(verifyEmail(pending)).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
    await expect(resetPassword({ token: reset, newPassword: 'Replay123!' })).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
  })
  it('never verifies a replacement mailbox with a token for the old mailbox', async () => {
    const token = signEmailVerificationToken({ id: String(account._id), email: account.email, authVersion: 0 })
    account.email = 'replacement@example.test'
    await expect(verifyEmail(token)).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
    expect(userRepository.verifyEmail).not.toHaveBeenCalled()
  })
  it('keeps the active email if SMTP delivery fails', async () => {
    vi.mocked(sendVerificationEmail).mockResolvedValue(false)
    await expect(changeEmail(String(account._id), { newEmail: 'new@example.test', oldPassword: 'Original123!' })).rejects.toMatchObject({ code: 'EMAIL_UNAVAILABLE' })
    expect(account.email).toBe('old@example.test')
  })
})
