import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { redis } from '../config/redis.js'
import { logger } from '../common/logger.js'
import { seoService } from '../modules/seo/seo.service.js'
import { env } from '../config/env.js'

const LOCK = 'seo:sitemap:lock'
const POINTER = 'seo:sitemap:current'
const TTL = 7200
const BUDGET = 32 * 1024 * 1024
const shard = z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(1000)
const manifestSchema = z.object({
  generation: z.string().regex(/^[a-f0-9]{16}$/),
  storyShards: z.array(shard).max(10000), chapterShards: z.array(shard).max(10000), builtAt: z.string().datetime()
})
export type SitemapManifest = z.infer<typeof manifestSchema>
const summarySchema = z.object({
  generation: z.string().regex(/^[a-f0-9]{16}$/), builtAt: z.string().datetime(),
  storyShardCount: z.number().int().min(0).max(10000), chapterShardCount: z.number().int().min(0).max(10000)
})
type SitemapSummary = z.infer<typeof summarySchema>
const shardKey = (id: string) => 'seo:sitemap:shards:' + id
let timer: NodeJS.Timeout | undefined
let running: Promise<void> | undefined
let active: AbortController | undefined
let stopped = false

/** Always use Redis, including old generations: replicas must see the same manifest. */
export async function getManifest(generation?: string): Promise<SitemapManifest | null> {
  if (redis.status !== 'ready') throw new Error('Sitemap storage unavailable')
  const id = generation ?? await redis.get(POINTER)
  if (!id || !/^[a-f0-9]{16}$/.test(id)) return null
  const raw = await redis.get('seo:sitemap:manifest:' + id)
  if (!raw) return null
  if (Buffer.byteLength(raw) > BUDGET) throw new Error('Manifest budget exceeded')
  const parsed = manifestSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) throw new Error('Invalid stored sitemap manifest')
  const manifest = parsed.data
  if (manifest.generation !== id) throw new Error('Manifest generation mismatch')
  return manifest
}

/** Small immutable metadata, with fallback for generations published by old replicas. */
export async function getSummary(generation?: string): Promise<(SitemapSummary & { format: 'shards' | 'legacy' }) | null> {
  if (redis.status !== 'ready') throw new Error('Sitemap storage unavailable')
  const id = generation ?? await redis.get(POINTER)
  if (!id || !/^[a-f0-9]{16}$/.test(id)) return null
  const raw = await redis.hget(shardKey(id), 'meta')
  if (raw !== null) {
    if (Buffer.byteLength(raw) > 1024) throw new Error('Sitemap metadata budget exceeded')
    const parsed = summarySchema.safeParse(JSON.parse(raw))
    if (!parsed.success) throw new Error('Invalid stored sitemap metadata')
    const summary = parsed.data
    if (summary.generation !== id) throw new Error('Manifest generation mismatch')
    return { ...summary, format: 'shards' }
  }
  const legacy = await getManifest(id)
  return legacy ? { generation: id, builtAt: legacy.builtAt, storyShardCount: legacy.storyShards.length, chapterShardCount: legacy.chapterShards.length, format: 'legacy' } : null
}

/** Reads at most one 1000-ID shard for new generations; never trusts stored XML. */
export async function getShard(generation: string, kind: 'stories' | 'chapters', index: number): Promise<string[] | null> {
  const summary = await getSummary(generation)
  if (!summary) return null
  const count = kind === 'stories' ? summary.storyShardCount : summary.chapterShardCount
  if (!Number.isInteger(index) || index < 0 || index >= count) return null
  const raw = await redis.hget(shardKey(generation), `${kind}:${index}`)
  if (raw !== null) {
    if (Buffer.byteLength(raw) > 28 * 1024) throw new Error('Sitemap shard budget exceeded')
    const parsed = shard.safeParse(JSON.parse(raw))
    if (!parsed.success) throw new Error('Invalid stored sitemap shard')
    return parsed.data
  }
  // Old JSON is also retained for old code during a rolling deployment.
  if (summary.format === 'shards') throw new Error('Missing stored sitemap shard')
  const legacy = await getManifest(generation)
  if (!legacy) throw new Error('Missing stored sitemap shard')
  return (kind === 'stories' ? legacy.storyShards : legacy.chapterShards)[index] ?? null
}

async function build(): Promise<void> {
  if (stopped || redis.status !== 'ready') return
  const token = randomBytes(16).toString('hex')
  if (await redis.set(LOCK, token, 'EX', 60, 'NX') !== 'OK') return
  const abort = new AbortController()
  active = abort
  if (stopped) abort.abort()
  const deadline = setTimeout(() => abort.abort(), 240_000)
  const renewal = setInterval(() => {
    void redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('expire',KEYS[1],60) end return 0", 1, LOCK, token)
      .then(result => { if (result !== 1) abort.abort() }).catch(() => abort.abort())
  }, 20_000)
  try {
    abort.signal.throwIfAborted()
    const generation = randomBytes(8).toString('hex')
    const { shards: storyShards } = await seoService.buildSitemapManifestData('stories', abort.signal)
    abort.signal.throwIfAborted()
    const { shards: chapterShards } = await seoService.buildSitemapManifestData('chapters', abort.signal)
    abort.signal.throwIfAborted()
    const manifest: SitemapManifest = { generation, storyShards, chapterShards, builtAt: new Date().toISOString() }
    const payload = JSON.stringify(manifest)
    const summary: SitemapSummary = { generation, builtAt: manifest.builtAt, storyShardCount: storyShards.length, chapterShardCount: chapterShards.length }
    const fields: string[][] = [['meta', JSON.stringify(summary)]]
    for (const [kind, shards] of [['stories', storyShards], ['chapters', chapterShards]] as const) {
      shards.forEach((ids, index) => fields.push([`${kind}:${index}`, JSON.stringify(ids)]))
    }
    // Include BOTH formats in retention accounting; do not hide rollout memory cost.
    const storedBytes = Buffer.byteLength(payload) + fields.reduce((sum, [field, value]) => sum + Buffer.byteLength(field) + Buffer.byteLength(value), 0)
    if (storedBytes > BUDGET) throw new Error('Manifest budget exceeded')
    // Fence publication against lease loss. No stale worker can overwrite a newer pointer.
    const published = await redis.eval(
      `
      if redis.call('get',KEYS[1]) ~= ARGV[1] then return 0 end
      local now = tonumber(redis.call('time')[1])
      redis.call('zremrangebyscore',KEYS[4],'-inf',now)
      local total = tonumber(ARGV[7])
      for _, member in ipairs(redis.call('zrange',KEYS[4],0,-1)) do
        total = total + tonumber(string.match(member,':(%d+)$'))
      end
      if total > tonumber(ARGV[5]) then return -1 end
      if redis.call('exists',KEYS[2]) == 1 or redis.call('exists',KEYS[5]) == 1 then return 0 end
      local fields = cjson.decode(ARGV[6])
      for _, pair in ipairs(fields) do redis.call('hset',KEYS[5],pair[1],pair[2]) end
      redis.call('expire',KEYS[5],ARGV[4])
      redis.call('set',KEYS[2],ARGV[2],'EX',ARGV[4])
      redis.call('set',KEYS[3],ARGV[3],'EX',ARGV[4])
      redis.call('zadd',KEYS[4],now+tonumber(ARGV[4]),ARGV[3]..':'..ARGV[7])
      redis.call('expire',KEYS[4],ARGV[4])
      return 1`,
      5, LOCK, 'seo:sitemap:manifest:' + generation, POINTER, 'seo:sitemap:generations', shardKey(generation), token, payload, generation, TTL, BUDGET, JSON.stringify(fields), storedBytes)
    if (published !== 1) throw new Error(published === -1 ? 'Retained sitemap budget exceeded' : 'Lost sitemap publication lease')
    logger.info('[SEO Sitemap] Published', { generation, stories: storyShards.length, chapters: chapterShards.length, storedBytes, retentionSeconds: TTL, budgetBytes: BUDGET })
  } finally {
    clearTimeout(deadline)
    clearInterval(renewal)
    active = undefined
    await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) end return 0", 1, LOCK, token).catch(() => undefined)
  }
}
export function runNow(): Promise<void> {
  if (!running) running = build().catch(error => { logger.error('[SEO Sitemap] Build failed', { name: error instanceof Error ? error.name : 'Unknown', message: error instanceof Error ? error.message : 'Unknown failure' }) }).finally(() => { running = undefined })
  return running
}
export async function startSitemapJob(): Promise<void> {
  if (timer) return
  stopped = false
  void runNow()
  timer = setInterval(() => { void runNow() }, env.SEO_SITEMAP_INTERVAL_MS)
  timer.unref()
}
export async function stopSitemapJob(): Promise<void> {
  stopped = true
  clearInterval(timer)
  timer = undefined
  active?.abort()
  await running
}
export const sitemapJob = { getManifest, getSummary, getShard, start: startSitemapJob, stop: stopSitemapJob, runNow }
