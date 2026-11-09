import { createHmac } from 'node:crypto'
import type { Request } from 'express'
import { describe, expect, it, vi } from 'vitest'
vi.mock('../../config/env.js', () => ({ env: { SSR_SIGNING_SECRET: 'a'.repeat(64) } }))
import { seoRateIdentity } from '../seoRateIdentity.js'
const request = (client: string, changes: Record<string, string> = {}) => {
  const timestamp = String(Math.floor(Date.now() / 1000)), path = '/api/v1/seo/catalog/home'
  const headers = { 'X-SSR-Client': client, 'X-SSR-Time': timestamp,
    'X-SSR-Signature': createHmac('sha256', 'a'.repeat(64)).update(`${timestamp}\n${client}\n${path}`).digest('hex'), ...changes }
  return { originalUrl: path, ip: 'renderer', socket: {}, get: (name: string) => headers[name as keyof typeof headers] } as unknown as Request
}
describe('signed SSR quota identity', () => {
  it('separates clients behind one renderer without trusting arbitrary forwarded headers', () => {
    expect(seoRateIdentity(request('1'.repeat(64)))).not.toBe(seoRateIdentity(request('2'.repeat(64))))
    expect(seoRateIdentity(request('1'.repeat(64), { 'X-SSR-Signature': '0'.repeat(64) }))).toBe('ip:renderer')
  })
  it('rejects expired proofs and proofs for another route', () => {
    expect(seoRateIdentity(request('1'.repeat(64), { 'X-SSR-Time': '1000000000' }))).toBe('ip:renderer')
    const req = request('1'.repeat(64)); req.originalUrl += '?limit=100'
    expect(seoRateIdentity(req)).toBe('ip:renderer')
  })
})
