import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../config/env.js', () => ({ env: { GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'test', PORT: 4000 } }))
vi.mock('../../../common/jwt.js', () => ({ getPublicKey: () => 'test' }))
vi.mock('../../../common/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))
vi.mock('../../../repositories/user.repository.js', () => ({ userRepository: { findByProvider: vi.fn(), findByEmail: vi.fn(), create: vi.fn() } }))
import passport from 'passport'
import { initPassport } from '../oauth/passport.js'
import { userRepository } from '../../../repositories/user.repository.js'

type Callback = (err: unknown, user?: unknown) => void
const google = (id = 'subject-1', email = 'victim@example.test') => new Promise<{ error: unknown; user: unknown }>(resolve => {
  const strategy = (passport as unknown as { _strategy(name: string): { _verify(a: string, b: string, p: unknown, cb: Callback): void } })._strategy('google')
  strategy._verify('', '', { id, emails: [{ value: email, verified: true }], displayName: 'Victim' }, (error, user) => resolve({ error, user }))
})
beforeEach(() => { vi.resetAllMocks(); initPassport(); vi.mocked(userRepository.findByProvider).mockResolvedValue(null); vi.mocked(userRepository.findByEmail).mockResolvedValue(null) })
describe('Google stable identity without automatic local linking', () => {
  it.each([false, true])('rejects a pre-existing local account (email verified=%s)', async verified => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({ provider: 'local', password: 'attacker-hash', isEmailVerified: verified } as never)
    expect((await google()).error).toMatchObject({ code: 'OAUTH_LINK_REQUIRED' })
    expect(userRepository.create).not.toHaveBeenCalled()
  })
  it('resolves the provider subject even if the upstream email changes', async () => {
    vi.mocked(userRepository.findByProvider).mockResolvedValue({ _id: 'owner', email: 'old@example.test', provider: 'google', providerId: 'subject-1', role: 'user' } as never)
    const result = await google('subject-1', 'changed@example.test')
    expect(result.error).toBeNull()
    expect(result.user).toMatchObject({ id: 'owner', email: 'old@example.test' })
    expect(userRepository.findByEmail).not.toHaveBeenCalled()
  })
  it('rejects another provider subject sharing an existing account email', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({ provider: 'google', providerId: 'other-subject' } as never)
    expect((await google()).error).toMatchObject({ code: 'OAUTH_LINK_REQUIRED' })
  })
})
