import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { rateLimit } from '../rateLimit.js'
import { redis } from '../../config/redis.js'
vi.mock('../../config/redis.js', () => ({ redis: { status: 'ready', eval: vi.fn() } }))
beforeEach(() => { vi.resetAllMocks(); Object.assign(redis, { status: 'ready' }) })
const req = { ip: '127.0.0.1', id: 'test' } as Request
const response = () => ({ setHeader: vi.fn() }) as unknown as Response
describe('rate limit failure boundaries', () => {
  it('returns 503 when Redis is unavailable, never grants unlimited requests', async () => {
    Object.assign(redis, { status: 'end' })
    const next = vi.fn()
    await rateLimit({ windowSeconds: 60, maxRequests: 2 })(req, response(), next)
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 503 }))
  })
  it('returns Retry-After for exhausted budgets', async () => {
    vi.mocked(redis.eval).mockResolvedValue([3, 42])
    const next = vi.fn(), res = response()
    await rateLimit({ windowSeconds: 60, maxRequests: 2 })(req, res, next)
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 429 }))
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '42')
  })
  it('allows requests within the atomic budget', async () => {
    vi.mocked(redis.eval).mockResolvedValue([2, 42])
    const next = vi.fn()
    await rateLimit({ windowSeconds: 60, maxRequests: 2 })(req, response(), next)
    expect(next).toHaveBeenCalledWith()
  })
})
