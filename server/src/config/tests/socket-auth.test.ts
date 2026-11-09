import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticateSocket, type AuthenticatedSocket } from '../socket.js'
import { verifyToken } from '../../common/jwt.js'
import { userRepository } from '../../repositories/user.repository.js'
vi.mock('../../common/jwt.js')
vi.mock('../../repositories/user.repository.js')
beforeEach(() => vi.resetAllMocks())
const socket = () => ({ handshake: { auth: { token: 'test-token' }, headers: {} }, data: {} }) as unknown as AuthenticatedSocket
describe('private socket identity', () => {
  it.each(['refresh', 'verify_email', 'reset_password', undefined])('rejects token purpose %s', async type => {
    vi.mocked(verifyToken).mockReturnValue({ id: 'user', type, exp: Date.now() / 1000 + 60 })
    const client = socket()
    await expect(authenticateSocket(client)).rejects.toThrow()
    expect(client.data.user).toBeUndefined()
  })
  it.each([null, { isLocked: true }])('rejects unavailable accounts', async user => {
    vi.mocked(verifyToken).mockReturnValue({ id: 'user', type: 'access', exp: Date.now() / 1000 + 60 })
    vi.mocked(userRepository.findById).mockResolvedValue(user as never)
    await expect(authenticateSocket(socket())).rejects.toThrow()
  })
  it('accepts only a live account with an expiring access token', async () => {
    vi.mocked(verifyToken).mockReturnValue({ id: 'user', type: 'access', exp: Date.now() / 1000 + 60 })
    vi.mocked(userRepository.findById).mockResolvedValue({ isLocked: false } as never)
    const client = socket()
    await authenticateSocket(client)
    expect(client.data.user?.id).toBe('user')
  })
})
