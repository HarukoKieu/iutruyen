import { beforeEach, expect, it, vi } from 'vitest'
const redis = vi.hoisted(() => ({ status: 'ready', get: vi.fn(), set: vi.fn(), eval: vi.fn() }))
vi.mock('../../../config/redis.js', () => ({ redis }))
import { crawlerCache } from '../crawler.cache.js'
import { AppError } from '../../../common/AppError.js'
beforeEach(() => { vi.clearAllMocks(); redis.status = 'ready'; redis.set.mockResolvedValue('OK'); redis.eval.mockResolvedValue(1) })
it('fails closed when Redis is unavailable', async () => {
  redis.status = 'reconnecting'
  const work = vi.fn()
  await expect(crawlerCache.withHost('books.example.org', work)).rejects.toMatchObject({ statusCode: 503 })
  expect(work).not.toHaveBeenCalled()
})
it('refuses concurrent host work and sets cooldown after failures', async () => {
  redis.set.mockResolvedValueOnce(null)
  const work = vi.fn()
  await expect(crawlerCache.withHost('books.example.org', work)).rejects.toMatchObject({ statusCode: 429 })
  expect(work).not.toHaveBeenCalled()
  await expect(crawlerCache.withHost('books.example.org', async () => { throw new Error('source failed') })).rejects.toThrow('source failed')
  expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining('PEXPIRE'), 1, 'crawler:host:books.example.org', expect.any(String), 2000)
})
it('enforces a per-user quota', async () => {
  redis.eval.mockResolvedValue(21)
  await expect(crawlerCache.quota('user')).rejects.toMatchObject({ statusCode: 429 })
})
it('shares upstream Retry-After cooldown across workers on the same source', async () => {
  const error = new AppError(429, 'Upstream limit', 'CRAWLER_UPSTREAM_RATE_LIMITED')
  error.retryAfterSeconds = 120
  await expect(crawlerCache.withHost('books.example.org', async () => { throw error })).rejects.toBe(error)
  expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining('PEXPIRE'), 1, 'crawler:host:books.example.org', expect.any(String), 120000)
})
