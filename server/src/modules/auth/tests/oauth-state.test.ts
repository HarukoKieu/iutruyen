import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
const mocks = vi.hoisted(() => ({ states: new Map<string, string>(), authenticate: vi.fn(() => vi.fn()) }))
vi.mock('passport', () => ({ default: { authenticate: mocks.authenticate } }))
vi.mock('../../../config/env.js', () => ({ env: { NODE_ENV: 'production' } }))
vi.mock('../../../config/redis.js', () => ({ redis: { status: 'ready',
  set: vi.fn(async (key: string, value: string) => { mocks.states.set(key, value); return 'OK' }),
  getdel: vi.fn(async (key: string) => { const value = mocks.states.get(key); mocks.states.delete(key); return value ?? null }),
} }))
import { beginGoogleOAuth, verifyGoogleOAuthState } from '../oauth/state.js'
import { redis } from '../../../config/redis.js'
const response = () => ({ cookie: vi.fn(), clearCookie: vi.fn() }) as unknown as Response
beforeEach(() => { vi.clearAllMocks(); mocks.states.clear() })
describe('Google browser-bound state', () => {
  it('sets a short-lived HttpOnly cookie and consumes matching state exactly once', async () => {
    const res = response(), next = vi.fn()
    await beginGoogleOAuth({} as Request, res, next)
    const state = vi.mocked(res.cookie).mock.calls[0][1] as string
    expect(res.cookie).toHaveBeenCalledWith('googleOAuthState', state, expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600000 }))
    expect(mocks.authenticate).toHaveBeenCalledWith('google', expect.objectContaining({ state }))
    const req = { query: { state }, cookies: { googleOAuthState: state } } as unknown as Request
    await verifyGoogleOAuthState(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    await expect(verifyGoogleOAuthState(req, res, next)).rejects.toMatchObject({ code: 'OAUTH_STATE_INVALID' })
    expect(next).toHaveBeenCalledOnce()
  })
  it.each([undefined, 'invalid', 'b'.repeat(64)])('rejects missing/malformed/cross-browser cookie %s before consuming', async cookie => {
    const state = 'a'.repeat(64)
    const req = { query: { state }, cookies: { googleOAuthState: cookie } } as unknown as Request
    await expect(verifyGoogleOAuthState(req, response(), vi.fn())).rejects.toMatchObject({ code: 'OAUTH_STATE_INVALID' })
    expect(redis.getdel).not.toHaveBeenCalled()
  })
})
