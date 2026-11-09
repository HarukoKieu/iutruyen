import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ store: new Map<string, string>(), hashes: new Map<string, Map<string, string>>(), loseLease: false, build: vi.fn() }))
vi.mock('../../config/env.js', () => ({ env: { SEO_SITEMAP_INTERVAL_MS: 900000 } }))
vi.mock('../../common/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))
vi.mock('../../modules/seo/seo.service.js', () => ({ seoService: { buildSitemapManifestData: mocks.build } }))
vi.mock('../../config/redis.js', () => ({ redis: {
  status: 'ready', get: vi.fn(async (key: string) => mocks.store.get(key) ?? null),
  hget: vi.fn(async (key: string, field: string) => mocks.hashes.get(key)?.get(field) ?? null),
  set: vi.fn(async (key: string, value: string) => { if (mocks.store.has(key)) return null; mocks.store.set(key, value); return 'OK' }),
  eval: vi.fn(async (_script: string, count: number, ...args: string[]) => {
    const [lock] = args
    const token = args[count]
    if (mocks.loseLease || mocks.store.get(lock) !== token) return 0
    if (count === 5) { mocks.store.set(args[1], args[6]); mocks.store.set(args[2], args[7]); mocks.hashes.set(args[4], new Map(JSON.parse(args[10]))) }
    else mocks.store.delete(lock)
    return 1
  }),
} }))
import { sitemapJob } from '../sitemap-manifest.job.js'
import { redis } from '../../config/redis.js'

describe('sitemap generation lifecycle', () => {
  beforeEach(() => { mocks.store.clear(); mocks.hashes.clear(); mocks.loseLease = false; vi.clearAllMocks(); mocks.build.mockReset().mockResolvedValue({ shards: [['507f1f77bcf86cd799439011']] }) })
  it('keeps previous generation readable when a new index is published', async () => {
    await sitemapJob.runNow()
    const first = await sitemapJob.getManifest()
    await sitemapJob.runNow()
    expect((await sitemapJob.getManifest())?.generation).not.toBe(first?.generation)
    expect(await sitemapJob.getManifest(first!.generation)).toEqual(first)
  })
  it('fences a worker that loses the lease before publication', async () => {
    await sitemapJob.runNow()
    const first = await sitemapJob.getManifest()
    mocks.build.mockImplementation(async () => { mocks.loseLease = true; return { shards: [] } })
    await sitemapJob.runNow()
    expect(await sitemapJob.getManifest()).toEqual(first)
  })
  it('coalesces overlapping builds', async () => {
    await Promise.all([sitemapJob.runNow(), sitemapJob.runNow()])
    expect(mocks.build).toHaveBeenCalledTimes(2) // one stories scan + one chapters scan
  })
  it('rejects malformed manifests and never guesses a missing generation', async () => {
    mocks.store.set('seo:sitemap:manifest:aaaaaaaaaaaaaaaa', '{"generation":"other"}')
    await expect(sitemapJob.getManifest('aaaaaaaaaaaaaaaa')).rejects.toThrow()
    expect(await sitemapJob.getManifest('bbbbbbbbbbbbbbbb')).toBeNull()
  })
  it('serves one shard without GET/parsing the complete inventory', async () => {
    await sitemapJob.runNow()
    const summary = (await sitemapJob.getSummary())!
    vi.mocked(redis.get).mockClear()
    expect(await sitemapJob.getShard(summary.generation, 'stories', 0)).toEqual(['507f1f77bcf86cd799439011'])
    expect(redis.get).not.toHaveBeenCalled()
    expect(await sitemapJob.getShard(summary.generation, 'stories', 1)).toBeNull()
  })
  it('reads old JSON generations, but fails closed for corrupted new shards', async () => {
    await sitemapJob.runNow()
    const summary = (await sitemapJob.getSummary())!
    const fields = mocks.hashes.get('seo:sitemap:shards:' + summary.generation)!
    fields.set('stories:0', '["bad-id"]')
    await expect(sitemapJob.getShard(summary.generation, 'stories', 0)).rejects.toThrow('Invalid stored sitemap shard')
    fields.delete('stories:0')
    await expect(sitemapJob.getShard(summary.generation, 'stories', 0)).rejects.toThrow('Missing stored sitemap shard')
    mocks.hashes.clear()
    expect((await sitemapJob.getSummary())?.format).toBe('legacy')
    expect(await sitemapJob.getShard(summary.generation, 'stories', 0)).toEqual(['507f1f77bcf86cd799439011'])
  })
  it('stop waits for an active build and cancels publication', async () => {
    let finish!: () => void
    mocks.build.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ shards: [] }) }))
    const pending = sitemapJob.runNow()
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    const stopped = sitemapJob.stop()
    finish()
    // Aborted build must not start the second scan (guard before each stage).
    await stopped
    await pending
    expect(mocks.store.has('seo:sitemap:current')).toBe(false)
  })
})
