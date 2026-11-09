import { describe, expect, it, vi } from 'vitest'
import { User } from '../../models/User.model.js'
import { userRepository } from '../user.repository.js'

describe('credential compare-and-swap database operations', () => {
  it('uses a single conditional write for a password and its revocation epoch', async () => {
    const write = vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null)
    await userRepository.updatePassword('507f1f77bcf86cd799439011', 'hash', { email: 'a@example.test', authVersion: 3 })
    expect(write).toHaveBeenCalledWith({ _id: '507f1f77bcf86cd799439011', email: 'a@example.test', authVersion: 3 },
      { $set: { password: 'hash' }, $inc: { authVersion: 1 } }, { new: true, runValidators: true })
    write.mockRestore()
  })
  it('supports only untouched legacy accounts for epoch zero and advances on email swap', async () => {
    const write = vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null)
    await userRepository.confirmEmailChange('507f1f77bcf86cd799439011', 'b@example.test', { email: 'a@example.test', authVersion: 0 })
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@example.test', $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] }),
      { $set: { email: 'b@example.test', isEmailVerified: true }, $inc: { authVersion: 1 } }, { new: true, runValidators: true })
    write.mockRestore()
  })
})
