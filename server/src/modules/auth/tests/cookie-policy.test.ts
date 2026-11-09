import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Response } from 'express'
const config = vi.hoisted(() => ({ NODE_ENV: 'production', COOKIE_DOMAIN: '' }))
vi.mock('../../../config/env.js', () => ({ env: config }))
vi.mock('../auth.service.js', () => ({ authService: {} }))
import { setRefreshTokenCookie, clearRefreshTokenCookie } from '../auth.controller.js'

describe('Refresh cookie policy', () => {
  beforeEach(() => { config.NODE_ENV = 'production'; config.COOKIE_DOMAIN = '' })
  it('uses a host-only HttpOnly Secure SameSite=None cookie in production', () => {
    const cookie = vi.fn()
    setRefreshTokenCookie({ cookie } as unknown as Response, 'test-token')
    expect(cookie).toHaveBeenCalledWith('refreshToken', 'test-token', {
      httpOnly: true, secure: true, sameSite: 'none', domain: undefined, path: '/', maxAge: 604800000,
    })
  })
  it('clears using the same domain/path/security attributes as creation', () => {
    config.COOKIE_DOMAIN = '.example.test'
    const cookie = vi.fn(), clearCookie = vi.fn()
    const response = { cookie, clearCookie } as unknown as Response
    setRefreshTokenCookie(response, 'test-token')
    clearRefreshTokenCookie(response)
    const { maxAge: _maxAge, ...attributes } = cookie.mock.calls[0][2]
    expect(clearCookie).toHaveBeenCalledWith('refreshToken', attributes)
  })
  it('allows local HTTP development with SameSite=Lax and no localhost domain', () => {
    config.NODE_ENV = 'development'; config.COOKIE_DOMAIN = 'localhost'
    const cookie = vi.fn()
    setRefreshTokenCookie({ cookie } as unknown as Response, 'test-token')
    expect(cookie).toHaveBeenCalledWith('refreshToken', 'test-token', expect.objectContaining({ secure: false, sameSite: 'lax', domain: undefined }))
  })
})
