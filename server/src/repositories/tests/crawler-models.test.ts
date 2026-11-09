import { describe, expect, it } from 'vitest'
import { Types } from 'mongoose'
import { CrawlerJob } from '../../models/CrawlerJob.model.js'
import { CrawlerTask } from '../../models/CrawlerTask.model.js'

const source = { url: 'https://fixture.example/story', destination: 'new', genreIds: [new Types.ObjectId()], from: 1, to: 2000, startOrder: 1,
  discovery: { visitedUrls: [] as string[], seenHashes: [] as string[], pageCount: 0, chapterCount: 0, complete: false } }
const makeJob = (sources = [source]) => new CrawlerJob({ actorId: new Types.ObjectId(), requestKey: '00000000-0000-4000-8000-000000000000', inputHash: 'a'.repeat(64), sources })
const makeTask = (extra = {}) => new CrawlerTask({ jobId: new Types.ObjectId(), sourceIndex: 0, sourceHash: 'a'.repeat(64), url: 'https://fixture.example/chapter', title: 'Chương 1', order: 1, position: 1, ...extra })

describe('crawler bounded persistence schema', () => {
  it('retains complete discovery state with bounded hash deduplication and no chapter bodies', async () => {
    const job = makeJob()
    expect(await job.validate()).toBeUndefined()
    expect(job.sources[0].discovery.seenHashes).toEqual([])
    expect(job.sources[0].discovery.attempts).toBe(0)
    expect(job.toObject().sources[0].counters).toEqual({ total: 0, pending: 0, succeeded: 0, skipped: 0, failed: 0 })
    await expect(makeJob([{ ...source, contentHtml: '<p>body</p>' } as typeof source]).validate()).rejects.toBeDefined()
  })
  it.each([0, 21])('rejects %i sources', async count => {
    await expect(makeJob(Array.from({ length: count }, () => source)).validate()).rejects.toBeDefined()
  })
  it.each([{ order: 1000001 }, { position: 2001 }, { sourceIndex: 20 }, { attempts: 4 }, { order: 1.5 }])('rejects task bounds %o', async extra => {
    await expect(makeTask(extra).validate()).rejects.toBeDefined()
  })
  it('rejects oversized discovery hash/page history and malformed hashes', async () => {
    const invalid = makeJob([{ ...source, discovery: { ...source.discovery, seenHashes: ['invalid'] } }])
    await expect(invalid.validate()).rejects.toBeDefined()
    const oversized = makeJob([{ ...source, discovery: { ...source.discovery, visitedUrls: Array.from({ length: 101 }, () => source.url) } }])
    await expect(oversized.validate()).rejects.toBeDefined()
  })
  it('declares idempotency and active actor uniqueness without a TTL that deletes work', () => {
    const indexes = CrawlerJob.schema.indexes()
    expect(indexes).toContainEqual([{ actorId: 1, requestKey: 1 }, expect.objectContaining({ unique: true })])
    expect(indexes).toContainEqual([{ actorId: 1, active: 1 }, expect.objectContaining({ unique: true, partialFilterExpression: { active: true } })])
    expect(indexes.every(([, options]) => !('expireAfterSeconds' in options))).toBe(true)
    expect(CrawlerTask.schema.indexes()).toContainEqual([{ jobId: 1, sourceIndex: 1, position: 1 }, expect.objectContaining({ unique: true })])
  })
})
