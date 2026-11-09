import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

const mocks = vi.hoisted(() => ({ sessions: new Map<string, string>(), set: vi.fn(), findUser: vi.fn() }))
vi.mock('../../../config/redis.js', () => ({ redis: {
  status: 'ready', set: mocks.set,
  get: vi.fn(async (key: string) => mocks.sessions.get(key) ?? null),
  del: vi.fn(async (key: string) => mocks.sessions.delete(key)),
  eval: vi.fn(async (_script: string, _count: number, key: string, _retry: string, _digest: string, record: string) => {
    if (!mocks.sessions.has(key)) return null
    mocks.sessions.set(key, record)
    return JSON.parse(record).token
  }),
} }))
vi.mock('../../../repositories/user.repository.js', () => ({ userRepository: { findById: mocks.findUser } }))
vi.mock('../../../emails/mailer.js', () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }))
import { oauthCallback } from '../auth.controller.js'
import { refresh, logout } from '../auth.service.js'

function response() {
  return { cookie: vi.fn(), redirect: vi.fn() } as unknown as Response
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.sessions.clear()
  mocks.set.mockReset().mockImplementation(async (key: string, value: string) => { mocks.sessions.set(key, value); return 'OK' })
  mocks.findUser.mockResolvedValue({ _id: 'google-user', role: 'user', username: 'google-user', isLocked: false })
})
describe('OAuth session survives a page reload', () => {
  it('registers the cookie session before redirecting, refreshes after reload and rejects it after logout', async () => {
    const res = response()
    await oauthCallback({ user: { id: 'google-user', role: 'user' } } as Request, res)
    expect(mocks.set).toHaveBeenCalledWith(expect.stringMatching(/^session:family:\{google-user:/), expect.any(String), 'EX', 604800)
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', expect.any(String), expect.objectContaining({ httpOnly: true, path: '/', maxAge: 604800000 }))
    expect(mocks.set.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(res.cookie).mock.invocationCallOrder[0])
    expect(res.redirect).toHaveBeenCalledWith(expect.stringMatching(/\/oauth-callback$/))
    const cookie = vi.mocked(res.cookie).mock.calls[0][1] as string
    const rotated = await refresh(cookie)
    expect(rotated.user.id).toBe('google-user')
    expect(rotated.refreshToken).not.toBe(cookie)
    await logout('google-user', rotated.refreshToken)
    await expect(refresh(rotated.refreshToken)).rejects.toMatchObject({ code: 'TOKEN_REVOKED' })
  })
  it('does not issue a cookie or successful redirect if session persistence fails', async () => {
    mocks.set.mockRejectedValueOnce(new Error('Redis write failed'))
    const res = response()
    await expect(oauthCallback({ user: { id: 'google-user', role: 'user' } } as Request, res)).rejects.toThrow('Redis write failed')
    expect(res.cookie).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })
  it('does not issue a session without an authenticated OAuth user', async () => {
    const res = response()
    await oauthCallback({} as Request, res)
    expect(mocks.set).not.toHaveBeenCalled()
    expect(res.cookie).not.toHaveBeenCalled()
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error=oauth_failed'))
  })
})
