import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import mongoose, { Types } from 'mongoose'
import { CrawlerJob, type CrawlerJobRecord } from '../../models/CrawlerJob.model.js'
import { CrawlerTask } from '../../models/CrawlerTask.model.js'
import { User } from '../../models/User.model.js'
import { Story } from '../../models/Story.model.js'
import { Chapter } from '../../models/Chapter.model.js'
import { crawlerJobRepository } from '../crawler-job.repository.js'
vi.mock('../crawler-story-source.repository.js', () => ({ crawlerStorySourceRepository: { find: vi.fn(), bind: vi.fn(), initialize: vi.fn() } }))
import { crawlerStorySourceRepository } from '../crawler-story-source.repository.js'

function query(value: unknown) {
  const chain: Record<string, unknown> = {}
  for (const key of ['select', 'session', 'maxTimeMS', 'sort', 'limit', 'lean', 'option']) chain[key] = vi.fn(() => chain)
  chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(value).then(resolve, reject)
  return chain as never
}
const actorId = new Types.ObjectId(), jobId = new Types.ObjectId(), taskId = new Types.ObjectId()
const actor = { _id: actorId, role: 'author', authorStatus: 'approved', isLocked: false }
const source = { url: 'https://fixture.example/story', destination: 'new' as const, genreIds: [new Types.ObjectId()], from: 1, to: 2000, startOrder: 1,
  metadata: { title: 'Truyện kiểm thử', description: 'Mô tả đủ độ dài dùng trong kiểm thử' },
  counters: { total: 1, pending: 1, succeeded: 0, skipped: 0, failed: 0 },
  discovery: { visitedUrls: [], seenHashes: [], pageCount: 1, chapterCount: 1, complete: true } }
function job(overrides: Partial<CrawlerJobRecord> = {}): CrawlerJobRecord {
  return { _id: jobId, actorId, requestKey: '00000000-0000-4000-8000-000000000000', inputHash: 'a'.repeat(64), status: 'running', phase: 'importing', active: true,
    revision: 0, sources: [source], rightsConfirmedAt: new Date(), leaseOwner: 'owner-a', leaseUntil: new Date(Date.now() + 60000), nextRunAt: new Date(),
    counters: { total: 1, pending: 1, succeeded: 0, skipped: 0, failed: 0 }, createdAt: new Date(), updatedAt: new Date(), ...overrides }
}
beforeEach(() => {
  const session = { withTransaction: vi.fn(async (callback: (session: unknown) => unknown) => callback(session)), endSession: vi.fn() }
  vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as never)
  vi.spyOn(User, 'findById').mockReturnValue(query(actor))
  vi.spyOn(User, 'updateOne').mockReturnValue(query({ matchedCount: 1 }))
  vi.mocked(crawlerStorySourceRepository.find).mockReset().mockResolvedValue(null)
  vi.mocked(crawlerStorySourceRepository.bind).mockReset().mockResolvedValue({} as never)
  vi.mocked(crawlerStorySourceRepository.initialize).mockReset().mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('crawler durable fencing contract', () => {
  it('rejects stale/pause-invalidated lease before checking permissions or writing chapters', async () => {
    const fence = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(null))
    const chapter = vi.spyOn(Chapter, 'create')
    await expect(crawlerJobRepository.commitChapter(String(jobId), 'stale-owner', { _id: taskId }, { contentHtml: '<p>text</p>', wordCount: 1 })).rejects.toMatchObject({ code: 'CRAWLER_LEASE_LOST' })
    expect(fence).toHaveBeenCalledWith(expect.objectContaining({ leaseOwner: 'stale-owner', active: true, leaseUntil: { $gt: expect.any(Date) } }), { $inc: { revision: 1 } }, expect.objectContaining({ session: expect.anything() }))
    expect(User.updateOne).not.toHaveBeenCalled()
    expect(chapter).not.toHaveBeenCalled()
  })

  it.each([{ role: 'author', authorStatus: 'revoked', isLocked: false }, { role: 'user', isLocked: false }, { role: 'admin', isLocked: true }])('rechecks worker actor and blocks revoked/locked identities: %o', async identity => {
    vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job()))
    vi.mocked(User.findById).mockReturnValue(query({ ...actor, ...identity }))
    const task = vi.spyOn(CrawlerTask, 'findOne')
    await expect(crawlerJobRepository.commitChapter(String(jobId), 'owner-a', { _id: taskId }, { contentHtml: '<p>text</p>', wordCount: 1 })).rejects.toMatchObject({ code: 'CRAWLER_PERMISSION_CHANGED' })
    expect(task).not.toHaveBeenCalled()
  })

  it('writes the actor document in the content transaction, so permission changes conflict', async () => {
    vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job()))
    vi.spyOn(CrawlerTask, 'findOne').mockReturnValue(query({ _id: taskId, status: 'succeeded', chapterId: new Types.ObjectId() }))
    await crawlerJobRepository.commitChapter(String(jobId), 'owner-a', { _id: taskId }, { contentHtml: '<p>text</p>', wordCount: 1 })
    expect(User.updateOne).toHaveBeenCalledWith({ _id: String(actorId) }, { $inc: { __v: 1 } }, expect.objectContaining({ session: expect.anything(), maxTimeMS: 5000, timestamps: false }))
  })

  it('release preserves an already scheduled quota deadline', async () => {
    const update = vi.spyOn(CrawlerJob, 'updateOne').mockReturnValue(query({ matchedCount: 1 }))
    const at = new Date(Date.now() + 60000)
    expect(await crawlerJobRepository.release(String(jobId), 'owner-a', at)).toBe(true)
    expect(update).toHaveBeenCalledWith(expect.anything(), { $max: { nextRunAt: at }, $unset: { leaseOwner: 1, leaseUntil: 1 } }, expect.anything())
  })

  it('a quota defer does not consume attempts or fail a task', async () => {
    vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job()))
    const update = vi.spyOn(CrawlerTask, 'updateOne').mockReturnValue(query({ matchedCount: 1 }))
    await crawlerJobRepository.deferTask(String(jobId), 'owner-a', String(taskId), new Date(), 'CRAWLER_RATE_LIMITED')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }), { $set: { nextRunAt: expect.any(Date), errorCode: 'CRAWLER_RATE_LIMITED' } }, expect.anything())
  })

  it('third network failure exhausts retries and atomically moves counters', async () => {
    const update = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job()))
    vi.spyOn(CrawlerTask, 'findOne').mockReturnValue(query({ _id: taskId, sourceIndex: 0, attempts: 2, status: 'pending' }))
    const task = vi.spyOn(CrawlerTask, 'updateOne').mockReturnValue(query({ matchedCount: 1 }))
    await crawlerJobRepository.recordTaskFailure(String(jobId), 'owner-a', String(taskId), 'CRAWLER_NETWORK_ERROR', new Date())
    expect(task).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ status: 'failed' }), $inc: { attempts: 1 } }), expect.anything())
    expect(update).toHaveBeenLastCalledWith(expect.anything(), { $set: { 'sources.0.counters': { total: 1, pending: 0, succeeded: 0, skipped: 0, failed: 1 } }, $inc: { 'counters.pending': -1, 'counters.failed': 1 } }, expect.anything())
  })

  it('start requires explicit rights confirmation before mutating state', async () => {
    vi.spyOn(CrawlerJob, 'findOne').mockReturnValue(query(job({ status: 'ready', phase: 'planning' })))
    const write = vi.spyOn(CrawlerJob, 'findOneAndUpdate')
    await expect(crawlerJobRepository.control(String(jobId), String(actorId), 'start')).rejects.toMatchObject({ code: 'CRAWLER_RIGHTS_REQUIRED' })
    expect(write).not.toHaveBeenCalled()
  })

  it('pause is a CAS transition and clears both lease fields', async () => {
    vi.spyOn(CrawlerJob, 'findOne').mockReturnValue(query(job()))
    const update = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job({ status: 'paused' })))
    await crawlerJobRepository.control(String(jobId), String(actorId), 'pause')
    expect(update).toHaveBeenCalledWith({ _id: String(jobId), status: 'running', active: true }, expect.objectContaining({ $set: expect.objectContaining({ status: 'paused' }), $unset: expect.objectContaining({ leaseOwner: 1, leaseUntil: 1 }) }), expect.objectContaining({ session: expect.anything() }))
  })

  it('terminal failure remains possible after actor revocation, to release the active slot', async () => {
    vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job({ status: 'failed', active: false })))
    await crawlerJobRepository.failJob(String(jobId), 'owner-a', 'CRAWLER_PERMISSION_CHANGED')
    expect(User.findById).not.toHaveBeenCalled()
  })

  it('binds jobs cursors to the actor and task cursors to job/status', async () => {
    const cursor = Buffer.from(JSON.stringify({ key: 'wrong', id: String(jobId), date: new Date().toISOString() })).toString('base64url')
    await expect(crawlerJobRepository.list(String(actorId), { limit: 20, cursor })).rejects.toMatchObject({ code: 'INVALID_CURSOR' })
    await expect(crawlerJobRepository.tasks(String(jobId), { limit: 50, cursor, status: 'failed' })).rejects.toMatchObject({ code: 'INVALID_CURSOR' })
  })

  it('production startup rejects missing indexes without creating any', async () => {
    const inspect = vi.spyOn(CrawlerJob, 'listIndexes').mockResolvedValue([{ key: { _id: 1 }, name: '_id_' }] as never)
    const init = vi.spyOn(CrawlerJob, 'init')
    await expect(crawlerJobRepository.initialize(true)).rejects.toMatchObject({ code: 'CRAWLER_INDEXES_MISSING', statusCode: 503 })
    expect(inspect).toHaveBeenCalled()
    expect(init).not.toHaveBeenCalled()
  })

  it('reschedules future pending work instead of completing it', async () => {
    const update = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job()))
    const nextRunAt = new Date(Date.now() + 30000)
    vi.spyOn(CrawlerTask, 'findOne').mockReturnValue(query({ nextRunAt }))
    await crawlerJobRepository.finishImport(String(jobId), 'owner-a')
    expect(update).toHaveBeenLastCalledWith(expect.anything(), { $set: { nextRunAt }, $unset: { leaseOwner: 1, leaseUntil: 1 } }, expect.anything())
  })

  it('never dequeues selected chapters from incomplete or failed catalog discovery', async () => {
    vi.spyOn(CrawlerJob, 'findById').mockReturnValue(query({ sources: [source, { ...source, errorCode: 'CRAWLER_NETWORK_ERROR' }, { ...source, discovery: { ...source.discovery, complete: false } }] }))
    const find = vi.spyOn(CrawlerTask, 'findOne').mockReturnValue(query(null))
    await crawlerJobRepository.nextTask(String(jobId))
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ sourceIndex: { $in: [0] } }))
  })

  it('skips an existing source URL before fetching, with actor/story/task and counter writes in one transaction', async () => {
    const storyId = new Types.ObjectId(), chapterId = new Types.ObjectId()
    const update = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job({ sources: [{ ...source, storyId }] })))
    vi.spyOn(CrawlerTask, 'findOne').mockReturnValue(query({ _id: taskId, sourceIndex: 0, sourceHash: 'b'.repeat(64), status: 'pending', order: 1 }))
    const parent = vi.spyOn(Story, 'findOneAndUpdate').mockReturnValue(query({ _id: storyId }))
    const find = vi.spyOn(Chapter, 'findOne').mockReturnValue(query({ _id: chapterId, order: 7 }))
    const task = vi.spyOn(CrawlerTask, 'updateOne').mockReturnValue(query({ matchedCount: 1 }))
    expect(await crawlerJobRepository.skipExisting(String(jobId), 'owner-a', String(taskId))).toBe(true)
    expect(parent).toHaveBeenCalledWith(expect.objectContaining({ _id: String(storyId), authorId: String(actorId) }), { $inc: { __v: 1 } }, expect.objectContaining({ session: expect.anything(), timestamps: false }))
    expect(find).toHaveBeenCalledWith({ storyId, slug: `crawl-${'b'.repeat(64)}` })
    expect(find).toHaveBeenCalledTimes(1)
    expect(task).toHaveBeenCalledWith(expect.anything(), { $set: { status: 'skipped', chapterId, order: 7 }, $unset: { errorCode: 1 } }, expect.objectContaining({ session: expect.anything() }))
    expect(update).toHaveBeenLastCalledWith(expect.anything(), { $set: { 'sources.0.counters': { total: 1, pending: 0, succeeded: 0, skipped: 1, failed: 0 } }, $inc: { 'counters.pending': -1, 'counters.skipped': 1 } }, expect.objectContaining({ session: expect.anything() }))
  })

  it('does not advance a task or overwrite content when the URL is not imported', async () => {
    const storyId = new Types.ObjectId()
    vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job({ sources: [{ ...source, storyId }] })))
    vi.spyOn(CrawlerTask, 'findOne').mockReturnValue(query({ _id: taskId, sourceIndex: 0, sourceHash: 'b'.repeat(64), status: 'pending' }))
    vi.spyOn(Story, 'findOneAndUpdate').mockReturnValue(query({ _id: storyId }))
    vi.spyOn(Chapter, 'findOne').mockReturnValue(query(null))
    const task = vi.spyOn(CrawlerTask, 'updateOne')
    expect(await crawlerJobRepository.skipExisting(String(jobId), 'owner-a', String(taskId))).toBe(false)
    expect(task).not.toHaveBeenCalled()
  })

  it('skips an occupied destination order before downloading, with an explicit reason and no content writes', async () => {
    const storyId = new Types.ObjectId(), chapterId = new Types.ObjectId()
    vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job({ sources: [{ ...source, storyId }] })))
    vi.spyOn(CrawlerTask, 'findOne').mockReturnValue(query({ _id: taskId, sourceIndex: 0, sourceHash: 'b'.repeat(64), status: 'pending', order: 1 }))
    vi.spyOn(Story, 'findOneAndUpdate').mockReturnValue(query({ _id: storyId }))
    const find = vi.spyOn(Chapter, 'findOne').mockReturnValueOnce(query(null)).mockReturnValueOnce(query({ _id: chapterId, order: 1 }))
    const write = vi.spyOn(CrawlerTask, 'updateOne').mockReturnValue(query({ matchedCount: 1 }))
    const chapterCreate = vi.spyOn(Chapter, 'create'), chapterUpdate = vi.spyOn(Chapter, 'updateOne')
    expect(await crawlerJobRepository.skipExisting(String(jobId), 'owner-a', String(taskId))).toBe(true)
    expect(find).toHaveBeenNthCalledWith(2, { storyId, order: 1 })
    expect(write).toHaveBeenCalledWith(expect.anything(), { $set: { status: 'skipped', chapterId, order: 1, errorCode: 'CHAPTER_ORDER_EXISTS' } }, expect.objectContaining({ session: expect.anything() }))
    expect(chapterCreate).not.toHaveBeenCalled(); expect(chapterUpdate).not.toHaveBeenCalled()
  })

  it('rechecks an order that becomes occupied after precheck and commits a skip instead of overwriting', async () => {
    const storyId = new Types.ObjectId(), chapterId = new Types.ObjectId()
    const update = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job({ sources: [{ ...source, storyId }] })))
    vi.spyOn(CrawlerTask, 'findOne').mockReturnValue(query({ _id: taskId, sourceIndex: 0, sourceHash: 'b'.repeat(64), status: 'pending', order: 1 }))
    vi.spyOn(Story, 'findOneAndUpdate').mockReturnValue(query({ _id: storyId }))
    vi.spyOn(Chapter, 'findOne').mockReturnValueOnce(query(null)).mockReturnValueOnce(query(null)).mockReturnValueOnce(query(null)).mockReturnValueOnce(query({ _id: chapterId, order: 1 }))
    const write = vi.spyOn(CrawlerTask, 'updateOne').mockReturnValue(query({ matchedCount: 1 }))
    const chapterCreate = vi.spyOn(Chapter, 'create')
    expect(await crawlerJobRepository.skipExisting(String(jobId), 'owner-a', String(taskId))).toBe(false)
    expect(await crawlerJobRepository.commitChapter(String(jobId), 'owner-a', { _id: taskId }, { contentHtml: '<p>different content</p>', wordCount: 2 })).toEqual({ status: 'skipped', chapterId: String(chapterId), errorCode: 'CHAPTER_ORDER_EXISTS' })
    expect(write).toHaveBeenCalledWith(expect.anything(), { $set: { status: 'skipped', chapterId, order: 1, errorCode: 'CHAPTER_ORDER_EXISTS' } }, expect.anything())
    expect(update).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ $inc: { 'counters.pending': -1, 'counters.skipped': 1 } }), expect.anything())
    expect(chapterCreate).not.toHaveBeenCalled()
  })

  it('the target picker scopes to owned visible stories, treats regex input literally and projects titles only', async () => {
    const row = { _id: new Types.ObjectId(), title: 'Story [test].*', createdAt: new Date(), coverUrl: 'private-cover', description: 'private-description' }
    const chain = query([row]) as Record<string, unknown>
    const find = vi.spyOn(Story, 'find').mockReturnValue(chain as never)
    const result = await crawlerJobRepository.targets(String(actorId), { q: '[test].*', limit: 20 })
    const filter = (find.mock.calls as unknown as unknown[][])[0][0] as { authorId: string; moderationStatus: unknown; title: RegExp }
    expect(filter.authorId).toBe(String(actorId))
    expect(filter.moderationStatus).toEqual({ $nin: ['hidden', 'removed'] })
    expect(filter.title.test('Story [test].*')).toBe(true)
    expect(filter.title.test('Story test anything')).toBe(false)
    expect(chain.select).toHaveBeenCalledWith('_id title createdAt')
    expect(chain.maxTimeMS).toHaveBeenCalledWith(3000)
    expect(result.items).toEqual([{ _id: row._id, title: row.title }])
  })

  it('binds target cursors to actor/search and retains tied-date rows via the ObjectId boundary', async () => {
    const createdAt = new Date('2026-10-14T00:00:00Z')
    const rows = [{ _id: new Types.ObjectId(), title: 'a', createdAt }, { _id: new Types.ObjectId(), title: 'b', createdAt }]
    const find = vi.spyOn(Story, 'find').mockReturnValue(query(rows))
    const page = await crawlerJobRepository.targets(String(actorId), { q: 'same', limit: 1 })
    expect(page.meta.hasMore).toBe(true)
    await expect(crawlerJobRepository.targets(String(actorId), { q: 'different', limit: 1, cursor: page.meta.nextCursor! })).rejects.toMatchObject({ code: 'INVALID_CURSOR' })
    await crawlerJobRepository.targets(String(actorId), { q: 'same', limit: 1, cursor: page.meta.nextCursor! })
    expect(find).toHaveBeenLastCalledWith(expect.objectContaining({ $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: rows[0]._id } }] }))
  })

  it('rechecks current DB role before granting admin job access and excludes large discovery histories', async () => {
    const chain = query(job()) as Record<string, unknown>
    const find = vi.spyOn(CrawlerJob, 'findOne').mockReturnValue(chain as never)
    await crawlerJobRepository.findOwned(String(jobId), String(actorId), true)
    expect(find).toHaveBeenLastCalledWith({ _id: String(jobId), actorId: String(actorId) })
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('-sources.discovery.seenHashes -sources.discovery.visitedUrls'))
    vi.mocked(User.findById).mockReturnValue(query({ ...actor, role: 'admin' }))
    await crawlerJobRepository.findOwned(String(jobId), String(actorId), true)
    expect(find).toHaveBeenLastCalledWith({ _id: String(jobId) })
  })

  it('clears discovery dedupe history only for completed sources, retaining failed cursors for retry', async () => {
    const completed = { ...source, discovery: { ...source.discovery, seenHashes: ['a'.repeat(64)], visitedUrls: [source.url] } }
    const failed = { ...source, errorCode: 'CRAWLER_NETWORK_ERROR', discovery: { ...completed.discovery, complete: false, nextUrl: 'https://fixture.example/page2' } }
    const update = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job({ status: 'planning', phase: 'planning', sources: [completed, failed] })))
    await crawlerJobRepository.finishPlanning(String(jobId), 'owner-a')
    expect(update).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ sources: [
      expect.objectContaining({ discovery: expect.objectContaining({ seenHashes: [], visitedUrls: [] }) }), failed,
    ] }) }), expect.anything())
  })

  it('replays a matching request without querying its mutable destination and rejects payload reuse', async () => {
    const find = vi.spyOn(CrawlerJob, 'findOne').mockReturnValue(query(job()))
    const target = vi.spyOn(Story, 'findOne')
    expect(await crawlerJobRepository.findRequest(String(actorId), job().requestKey, 'a'.repeat(64))).toMatchObject({ _id: jobId })
    expect(find).toHaveBeenCalledWith({ actorId: String(actorId), requestKey: job().requestKey })
    expect(target).not.toHaveBeenCalled()
    await expect(crawlerJobRepository.findRequest(String(actorId), job().requestKey, 'b'.repeat(64))).rejects.toMatchObject({ code: 'CRAWLER_REQUEST_CONFLICT' })
  })

  it('defers every pending task on the affected hostname, preserving other hosts and retry counters', async () => {
    const thirdSource = { ...source, url: 'https://another.example/story' }
    const updateJob = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job({ sources: [source, { ...source, url: 'https://fixture.example/second' }, thirdSource] })))
    const updateTasks = vi.spyOn(CrawlerTask, 'updateMany').mockReturnValue(query({ matchedCount: 4 }))
    const nextRunAt = new Date(Date.now() + 60000)
    await crawlerJobRepository.deferSource(String(jobId), 'owner-a', 0, nextRunAt, 'CRAWLER_UPSTREAM_RATE_LIMITED')
    expect(updateTasks).toHaveBeenCalledWith({ jobId: String(jobId), sourceIndex: { $in: [0, 1] }, status: 'pending' }, { $max: { nextRunAt }, $set: { errorCode: 'CRAWLER_UPSTREAM_RATE_LIMITED' } }, expect.objectContaining({ session: expect.anything(), runValidators: true }))
    expect(updateJob).toHaveBeenCalledTimes(1)
    expect(updateJob).toHaveBeenCalledWith(expect.anything(), { $inc: { revision: 1 } }, expect.anything())
  })

  it('catalog discovery increments source and job counters together, and a source failure preserves completed chapters', async () => {
    const update = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job({ status: 'planning', phase: 'planning' })))
    vi.spyOn(CrawlerTask, 'find').mockReturnValue(query([]))
    vi.spyOn(CrawlerTask, 'insertMany').mockResolvedValue([] as never)
    await crawlerJobRepository.saveCatalog(String(jobId), 'owner-a', 0, { discovery: { ...source.discovery, chapterCount: 2 } }, [
      { url: 'https://fixture.example/chapter2', title: 'Chương 2', position: 2, order: 2 },
    ])
    expect(update).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ $set: { 'sources.0': expect.objectContaining({ counters: { total: 2, pending: 2, succeeded: 0, skipped: 0, failed: 0 } }) }, $inc: { 'counters.total': 1, 'counters.pending': 1, 'counters.failed': 0 } }), expect.anything())
    update.mockReturnValue(query(job({ status: 'planning', phase: 'planning', sources: [{ ...source, counters: { total: 2, pending: 1, succeeded: 1, skipped: 0, failed: 0 } }] })))
    vi.spyOn(CrawlerTask, 'updateMany').mockReturnValue(query({ modifiedCount: 1 }))
    await crawlerJobRepository.saveCatalog(String(jobId), 'owner-a', 0, { discovery: source.discovery, errorCode: 'CRAWLER_NETWORK_ERROR' }, [])
    expect(update).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ $set: { 'sources.0': expect.objectContaining({ counters: { total: 2, pending: 0, succeeded: 1, skipped: 0, failed: 1 } }) }, $inc: { 'counters.total': 0, 'counters.pending': -1, 'counters.failed': 1 } }), expect.anything())
  })

  it('chapter commit increments per-source success with the same transaction, without aggregation for new jobs', async () => {
    const storyId = new Types.ObjectId(), chapterId = new Types.ObjectId()
    const update = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job({ sources: [{ ...source, storyId }] })))
    vi.spyOn(CrawlerTask, 'findOne').mockReturnValue(query({ _id: taskId, sourceIndex: 0, sourceHash: 'a'.repeat(64), status: 'pending', order: 1, title: 'Chương 1' }))
    vi.spyOn(Story, 'findOneAndUpdate').mockReturnValue(query({ _id: storyId }))
    vi.spyOn(Chapter, 'findOne').mockReturnValue(query(null))
    vi.spyOn(Chapter, 'exists').mockReturnValue(query(null))
    vi.spyOn(Chapter, 'create').mockResolvedValue([{ _id: chapterId }] as never)
    vi.spyOn(CrawlerTask, 'updateOne').mockReturnValue(query({ matchedCount: 1 }))
    const aggregate = vi.spyOn(CrawlerTask, 'aggregate')
    expect(await crawlerJobRepository.commitChapter(String(jobId), 'owner-a', { _id: taskId }, { contentHtml: '<p>test</p>', wordCount: 1 })).toEqual({ status: 'succeeded', chapterId: String(chapterId) })
    expect(aggregate).not.toHaveBeenCalled()
    expect(update).toHaveBeenLastCalledWith(expect.anything(), { $set: { 'sources.0.counters': { total: 1, pending: 0, succeeded: 1, skipped: 0, failed: 0 } }, $inc: { 'counters.pending': -1, 'counters.succeeded': 1 } }, expect.objectContaining({ session: expect.anything() }))
  })

  it('retry resets only source failures to pending, retaining completed/skipped progress', async () => {
    const first = { ...source, counters: { total: 3, pending: 0, succeeded: 1, skipped: 1, failed: 1 } }
    const second = { ...source, errorCode: 'CRAWLER_NETWORK_ERROR', counters: { total: 2, pending: 0, succeeded: 0, skipped: 0, failed: 2 } }
    const original = job({ status: 'completed_with_errors', active: false, sources: [first, second], counters: { total: 5, pending: 0, succeeded: 1, skipped: 1, failed: 3 } })
    vi.spyOn(CrawlerJob, 'findOne').mockReturnValue(query(original))
    vi.spyOn(CrawlerTask, 'updateMany').mockReturnValue(query({ modifiedCount: 3 }))
    const update = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(original))
    await crawlerJobRepository.control(String(jobId), String(actorId), 'retry')
    expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ 'counters.pending': 3, 'counters.failed': 0, sources: [
      expect.objectContaining({ counters: { total: 3, pending: 1, succeeded: 1, skipped: 1, failed: 0 } }),
      expect.objectContaining({ counters: { total: 2, pending: 2, succeeded: 0, skipped: 0, failed: 0 }, errorCode: undefined }),
    ] }) }), expect.objectContaining({ session: expect.anything() }))
  })

  it('lazily derives legacy source counters from durable task outcomes before moving a pending task', async () => {
    const storyId = new Types.ObjectId(), chapterId = new Types.ObjectId()
    const update = vi.spyOn(CrawlerJob, 'findOneAndUpdate').mockReturnValue(query(job({ sources: [{ ...source, storyId, counters: undefined }] })))
    vi.spyOn(CrawlerTask, 'findOne').mockReturnValue(query({ _id: taskId, sourceIndex: 0, sourceHash: 'a'.repeat(64), status: 'pending' }))
    vi.spyOn(Story, 'findOneAndUpdate').mockReturnValue(query({ _id: storyId }))
    vi.spyOn(Chapter, 'findOne').mockReturnValue(query({ _id: chapterId }))
    vi.spyOn(CrawlerTask, 'updateOne').mockReturnValue(query({ matchedCount: 1 }))
    const aggregate = vi.spyOn(CrawlerTask, 'aggregate').mockReturnValue(query([{ _id: 'pending', count: 1 }, { _id: 'succeeded', count: 2 }]))
    expect(await crawlerJobRepository.skipExisting(String(jobId), 'owner-a', String(taskId))).toBe(true)
    expect(aggregate).toHaveBeenCalledWith([{ $match: { jobId, sourceIndex: 0 } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
    expect(update).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ $set: { 'sources.0.counters': { total: 3, pending: 0, succeeded: 2, skipped: 1, failed: 0 } } }), expect.objectContaining({ session: expect.anything() }))
  })
})
