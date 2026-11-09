import { beforeEach, describe, expect, it, vi } from 'vitest'
const cache = vi.hoisted(() => ({ status: 'ready', set: vi.fn() }))
vi.mock('../../config/redis.js', () => ({ redis: cache }))
vi.mock('../logger.js', () => ({ logger: { warn: vi.fn() } }))
import { recordReadView } from '../readView.js'

describe('bounded read analytics', () => {
  beforeEach(() => { vi.clearAllMocks(); cache.status = 'ready' })
  it('records only the Redis NX winner and stores no raw IP', async () => {
    cache.set.mockResolvedValueOnce('OK').mockResolvedValue(null)
    const increment = vi.fn(async () => {})
    const result = await Promise.all(Array.from({ length: 5 }, () => recordReadView('story:test', '192.0.2.1', increment)))
    expect(result.filter(Boolean)).toHaveLength(1)
    expect(increment).toHaveBeenCalledTimes(1)
    expect(cache.set.mock.calls[0][0]).not.toContain('192.0.2.1')
    expect(cache.set.mock.calls[0].slice(1)).toEqual(['1', 'EX', 60, 'NX'])
  })
  it('does not block reading or count views when identity/cache/write is unavailable', async () => {
    const increment = vi.fn(async () => {})
    expect(await recordReadView('story:test', undefined, increment)).toBe(false)
    cache.status = 'end'
    expect(await recordReadView('story:test', 'ip', increment)).toBe(false)
    expect(cache.set).not.toHaveBeenCalled()
    cache.status = 'ready'; cache.set.mockRejectedValue(new Error('unavailable'))
    expect(await recordReadView('story:test', 'ip', increment)).toBe(false)
    expect(increment).not.toHaveBeenCalled()
    cache.set.mockResolvedValue('OK'); increment.mockRejectedValue(new Error('write failed'))
    expect(await recordReadView('story:test', 'ip', increment)).toBe(false)
  })
})
