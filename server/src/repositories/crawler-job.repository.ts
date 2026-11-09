import mongoose, { Types, type ClientSession, type FilterQuery } from 'mongoose'
import { createHash } from 'node:crypto'
import { CrawlerJob, type CrawlerJobRecord, type CrawlerSource, type CrawlerMetadata, type CrawlerDiscovery, type CrawlerControlAction, type CrawlerCounters } from '../models/CrawlerJob.model.js'
import { CrawlerTask, type CrawlerTaskRecord, type CrawlerTaskStatus } from '../models/CrawlerTask.model.js'
import { User } from '../models/User.model.js'
import { Story } from '../models/Story.model.js'
import { Chapter } from '../models/Chapter.model.js'
import { Genre } from '../models/Genre.model.js'
import { AppError } from '../common/AppError.js'
import { isAccountLocked } from '../common/accountState.js'
import { encodeCursor, decodeCursor, buildCursorMeta } from '../common/pagination.js'
import { crawlerStorySourceRepository } from './crawler-story-source.repository.js'

export interface CrawlerSourceInput {
  url: string
  storyId?: string
  genreIds?: string[]
  from?: number
  to?: number
  startOrder?: number
  reusedExisting?: boolean
  skipReason?: 'CRAWLER_STORY_EXISTS'
}
export interface CrawlerCatalogPatch {
  metadata?: CrawlerMetadata
  discovery: CrawlerDiscovery
  warning?: string
  errorCode?: string
}
export interface CrawlerCatalogTask { url: string; title: string; position: number; order: number }
export interface CrawlerChapterContent { contentHtml: string; wordCount: number; title?: string }
export interface CrawlerPageQuery { limit: number; cursor?: string }
export interface CrawlerTaskPageQuery extends CrawlerPageQuery { status?: CrawlerTaskStatus }
export interface CrawlerTargetsQuery extends CrawlerPageQuery { q?: string }

const MAX_TIME_MS = 5000
const LEASE_MS = 60000
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const executable = ['planning', 'queued', 'running']
const API_JOB_EXCLUSIONS = '-sources.discovery.seenHashes -sources.discovery.visitedUrls -leaseOwner -leaseUntil -requestKey -inputHash -revision'
const permissionError = () => AppError.forbidden('Quyền nhập truyện đã thay đổi', 'CRAWLER_PERMISSION_CHANGED')
const leaseError = () => AppError.conflict('Công việc đã tạm dừng hoặc worker không còn lease', 'CRAWLER_LEASE_LOST')
const duplicate = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
const sourceDuplicate = (error: unknown) => duplicate(error) && 'keyPattern' in (error as object) && Object.keys((error as { keyPattern: object }).keyPattern).join() === 'sourceHash'
const leaseFilter = (jobId: string, owner: string): FilterQuery<CrawlerJobRecord> => ({
  _id: jobId, leaseOwner: owner, leaseUntil: { $gt: new Date() }, active: true, status: { $in: executable },
})

async function transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(() => work(session), { maxCommitTimeMS: MAX_TIME_MS, timeoutMS: 15000, readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }) as T
  } finally { await session.endSession() }
}

async function sourceTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  try { return await transaction(work) }
  catch (error) {
    if (!sourceDuplicate(error)) throw error
    try { return await transaction(work) }
    catch (retryError) { if (sourceDuplicate(retryError)) throw new AppError(503, 'Nguồn đang được liên kết đồng thời. Sẽ kiểm tra lại.', 'CRAWLER_STORAGE_UNAVAILABLE'); throw retryError }
  }
}

async function requireActor(actorId: string, session?: ClientSession) {
  const query = User.findById(actorId).select('_id role authorStatus isLocked lockKind suspendedUntil').maxTimeMS(MAX_TIME_MS)
  if (session) query.session(session)
  const actor = await query.lean()
  if (!actor || isAccountLocked(actor) || (actor.role !== 'admin' && !(actor.role === 'author' && actor.authorStatus === 'approved'))) throw permissionError()
  // A real write makes account lock/revocation race with this transaction, not merely its snapshot read.
  if (session) {
    const result = await User.updateOne({ _id: actorId }, { $inc: { __v: 1 } }, { session, maxTimeMS: MAX_TIME_MS, timestamps: false })
    if (result.matchedCount !== 1) throw permissionError()
  }
  return actor
}

async function requireStory(storyId: string, actorId: string, isAdmin: boolean, session?: ClientSession, fence = false) {
  const filter = { _id: storyId, moderationStatus: { $nin: ['hidden', 'removed'] }, ...(isAdmin ? {} : { authorId: actorId }) }
  if (session && fence) {
    const row = await Story.findOneAndUpdate(filter, { $inc: { __v: 1 } }, { session, new: true, maxTimeMS: MAX_TIME_MS, timestamps: false }).select('_id title authorId moderationStatus').lean()
    if (!row) throw AppError.forbidden('Truyện đích đã bị ẩn, gỡ hoặc không còn thuộc quyền quản lý', 'CRAWLER_DESTINATION_CHANGED')
    return row
  }
  const query = Story.findOne(filter).select('_id title authorId moderationStatus').maxTimeMS(MAX_TIME_MS)
  if (session) query.session(session)
  const row = await query.lean()
  if (!row) throw AppError.forbidden('Truyện đích không thuộc quyền quản lý hoặc đã bị ẩn/gỡ', 'CRAWLER_DESTINATION_CHANGED')
  return row
}

async function requireGenres(genreIds: (string | Types.ObjectId)[], session?: ClientSession) {
  if (!genreIds.length || new Set(genreIds.map(String)).size !== genreIds.length) throw AppError.badRequest('Cần chọn thể loại hợp lệ cho truyện mới', 'CRAWLER_INVALID_GENRES')
  const query = Genre.countDocuments({ _id: { $in: genreIds } }).maxTimeMS(MAX_TIME_MS)
  if (session) query.session(session)
  if (await query !== genreIds.length) throw AppError.badRequest('Thể loại không còn tồn tại', 'CRAWLER_INVALID_GENRES')
}

async function fencedJob(jobId: string, owner: string, session: ClientSession, checkActor = true) {
  const job = await CrawlerJob.findOneAndUpdate(leaseFilter(jobId, owner), { $inc: { revision: 1 } }, { session, new: true, maxTimeMS: MAX_TIME_MS }).lean()
  if (!job) throw leaseError()
  if (checkActor) await requireActor(String(job.actorId), session)
  return job
}

async function updateJob(jobId: string, owner: string, update: object, session: ClientSession) {
  const job = await CrawlerJob.findOneAndUpdate(leaseFilter(jobId, owner), update, { session, new: true, runValidators: true, maxTimeMS: MAX_TIME_MS }).lean()
  if (!job) throw leaseError()
  return job
}

async function sourceCounters(job: CrawlerJobRecord, sourceIndex: number, session: ClientSession): Promise<CrawlerCounters> {
  const source = job.sources[sourceIndex]
  if (!source) throw AppError.badRequest('Nguồn không hợp lệ', 'CRAWLER_INVALID_SOURCE')
  if (source.counters) return { ...source.counters }
  // Jobs created before per-source progress retain their task rows; derive only when first changed.
  const rows = await CrawlerTask.aggregate<{ _id: CrawlerTaskStatus; count: number }>([
    { $match: { jobId: job._id, sourceIndex } }, { $group: { _id: '$status', count: { $sum: 1 } } },
  ]).session(session).option({ maxTimeMS: MAX_TIME_MS })
  const counters: CrawlerCounters = { total: 0, pending: 0, succeeded: 0, skipped: 0, failed: 0 }
  for (const row of rows) { counters[row._id] = row.count; counters.total += row.count }
  return counters
}

async function resolveInputSource(actorId: string, isAdmin: boolean, input: CrawlerSourceInput, session?: ClientSession, bind = false): Promise<CrawlerSourceInput> {
  const selectedId = input.storyId?.toLowerCase()
  const mapping = await crawlerStorySourceRepository.find(input.url, session)
  if (mapping) {
    if (selectedId && selectedId !== String(mapping.storyId)) throw AppError.conflict('URL nguồn đã được liên kết với một truyện khác', 'CRAWLER_SOURCE_CONFLICT')
    try {
      // Automatic reuse stays within the actor's own library; explicit admin targets retain admin permissions.
      await requireStory(String(mapping.storyId), actorId, !!selectedId && !input.reusedExisting && isAdmin, session, !!session)
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode !== 403) throw error
      return { ...input, storyId: undefined, genreIds: [], reusedExisting: false, skipReason: 'CRAWLER_STORY_EXISTS' }
    }
    return { ...input, storyId: String(mapping.storyId), genreIds: [], reusedExisting: !!input.reusedExisting || !selectedId, skipReason: undefined }
  }
  if (selectedId) {
    await requireStory(selectedId, actorId, isAdmin, session, !!session)
    if (bind && session) await crawlerStorySourceRepository.bind(input.url, selectedId, session)
    return { ...input, storyId: selectedId, genreIds: [], skipReason: undefined }
  }
  await requireGenres(input.genreIds ?? [], session)
  return { ...input, skipReason: undefined }
}

async function refreshSourceInTransaction(job: CrawlerJobRecord, sourceIndex: number, session: ClientSession) {
  const source = job.sources[sourceIndex]
  if (!source) throw AppError.badRequest('Nguồn không hợp lệ', 'CRAWLER_INVALID_SOURCE')
  if (source.skipReason) return source
  const actor = await requireActor(String(job.actorId), session)
  const resolved = await resolveInputSource(String(job.actorId), actor.role === 'admin', { ...source, storyId: source.storyId ? String(source.storyId) : undefined, genreIds: source.genreIds.map(String) }, session, true)
  if (resolved.skipReason) {
    const counters = await sourceCounters(job, sourceIndex, session)
    await CrawlerTask.updateMany({ jobId: job._id, sourceIndex, status: { $in: ['pending', 'failed'] } }, { $set: { status: 'skipped', errorCode: 'CRAWLER_STORY_EXISTS' }, $unset: { chapterId: 1 } }, { session, maxTimeMS: MAX_TIME_MS })
    const skipped: CrawlerSource = { ...source, storyId: undefined, metadata: undefined, errorCode: undefined, genreIds: [], reusedExisting: false, skipReason: 'CRAWLER_STORY_EXISTS',
      discovery: { ...source.discovery, complete: true, nextUrl: undefined, seenHashes: [], visitedUrls: [] },
      counters: { ...counters, pending: 0, failed: 0, skipped: counters.skipped + counters.pending + counters.failed } }
    await updateJob(String(job._id), job.leaseOwner!, { $set: { [`sources.${sourceIndex}`]: skipped }, $inc: { 'counters.pending': -counters.pending, 'counters.failed': -counters.failed, 'counters.skipped': counters.pending + counters.failed } }, session)
    job.sources[sourceIndex] = skipped
    return skipped
  }
  if (resolved.storyId && (!source.storyId || resolved.reusedExisting !== source.reusedExisting)) {
    const linked: CrawlerSource = { ...source, storyId: new Types.ObjectId(resolved.storyId), destination: 'existing', genreIds: [], reusedExisting: resolved.reusedExisting }
    await updateJob(String(job._id), job.leaseOwner!, { $set: { [`sources.${sourceIndex}`]: linked } }, session)
    job.sources[sourceIndex] = linked
    return linked
  }
  return source
}

function assertMetadata(metadata: CrawlerMetadata | undefined, coverBase64?: string): asserts metadata is CrawlerMetadata {
  if (!metadata || metadata.title.trim().length < 3 || metadata.title.trim().length > 150 || metadata.description.trim().length < 10 || metadata.description.trim().length > 5000) throw AppError.badRequest('Tên/mô tả nguồn chưa đáp ứng điều kiện tạo truyện', 'CRAWLER_INVALID_METADATA')
  if (coverBase64 && (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(coverBase64) || coverBase64.length > 800 * 1024)) throw AppError.badRequest('Ảnh bìa không hợp lệ', 'CRAWLER_INVALID_COVER')
}

async function ensureDestinationInTransaction(job: CrawlerJobRecord, sourceIndex: number, session: ClientSession, metadata?: CrawlerMetadata, coverBase64?: string) {
  const source = await refreshSourceInTransaction(job, sourceIndex, session)
  if (source.skipReason) return undefined
  const actor = await requireActor(String(job.actorId), session)
  if (source.storyId) {
    await requireStory(String(source.storyId), String(job.actorId), actor.role === 'admin', session, true)
    return String(source.storyId)
  }
  const info = metadata ?? source.metadata
  assertMetadata(info, coverBase64)
  await requireGenres(source.genreIds, session)
  const [story] = await Story.create([{
    title: info.title.trim(), slug: `crawl-${String(job._id)}-${sourceIndex}`, description: info.description.trim(),
    originalAuthor: info.originalAuthor, sourceName: info.sourceName || new URL(source.url).hostname,
    coverUrl: coverBase64, authorId: job.actorId, genreIds: source.genreIds, tagIds: [],
    status: info.status ?? 'ongoing', contentWarning: 'none', moderationStatus: 'pending',
  }], { session })
  await crawlerStorySourceRepository.bind(source.url, story._id, session)
  await updateJob(String(job._id), job.leaseOwner!, { $set: { [`sources.${sourceIndex}.storyId`]: story._id } }, session)
  source.storyId = story._id
  return String(story._id)
}

/** Durable, fenced MongoDB jobs. Every content mutation shares a transaction with its task and job progress. */
export const crawlerJobRepository = {
  /** Create indexes locally; production only verifies pre-provisioned indexes and fails closed. */
  async initialize(production = process.env.NODE_ENV === 'production') {
    await crawlerStorySourceRepository.initialize(production)
    if (!production) { await Promise.all([CrawlerJob.init(), CrawlerTask.init(), Chapter.init(), Story.init()]); return }
    for (const model of [CrawlerJob, CrawlerTask, Chapter, Story] as const) {
      let indexes: Awaited<ReturnType<typeof model.listIndexes>>
      try { indexes = await model.listIndexes() } catch { throw new AppError(503, 'Chưa chuẩn bị indexes crawler', 'CRAWLER_INDEXES_MISSING') }
      for (const [keys, options] of model.schema.indexes()) {
        // Existing parent collections only need the uniqueness guarantees crawler writes rely on.
        if ((model.modelName === 'Chapter' || model.modelName === 'Story') && !options.unique) continue
        const actual = indexes.find(index => JSON.stringify(index.key) === JSON.stringify(keys))
        if (!actual || !!actual.unique !== !!options.unique || JSON.stringify(actual.partialFilterExpression ?? {}) !== JSON.stringify(options.partialFilterExpression ?? {})) throw new AppError(503, 'Indexes crawler chưa đúng hợp đồng', 'CRAWLER_INDEXES_MISSING')
      }
    }
  },

  /** Verify current actor from the database, independently of its access token. */
  async assertActor(actorId: string) { return requireActor(actorId) },

  /** Validate ownership and selected genre IDs before reserving the single active job slot. */
  async validateTargets(actorId: string, sources: CrawlerSourceInput[]) {
    const actor = await requireActor(actorId)
    for (const source of sources) await resolveInputSource(actorId, actor.role === 'admin', source)
  },

  /** Resolve durable source identities without fetching websites or exposing foreign destination IDs. */
  async resolveSources(actorId: string, sources: CrawlerSourceInput[]) {
    const actor = await requireActor(actorId), resolved: CrawlerSourceInput[] = []
    for (const source of sources) resolved.push(await resolveInputSource(actorId, actor.role === 'admin', source))
    const targets = resolved.flatMap(source => source.storyId ? [source.storyId] : [])
    if (new Set(targets).size !== targets.length) throw AppError.conflict('Nhiều nguồn đang chọn cùng một truyện đích', 'CRAWLER_DUPLICATE_DESTINATION')
    return resolved
  },

  /** Replay a matching durable request before mutable source configuration or target state is revalidated. */
  async findRequest(actorId: string, requestKey: string, inputHash: string) {
    await requireActor(actorId)
    const job = await CrawlerJob.findOne({ actorId, requestKey }).select('-sources.discovery.seenHashes -sources.discovery.visitedUrls -leaseOwner -leaseUntil -revision').maxTimeMS(MAX_TIME_MS).lean()
    if (job && job.inputHash !== inputHash) throw AppError.conflict('requestKey đã dùng cho nội dung khác', 'CRAWLER_REQUEST_CONFLICT')
    return job
  },

  /** Request key deduplication and the actor's active-job reservation are enforced by unique indexes. */
  async enqueue(actorId: string, requestKey: string, inputHash: string, sources: CrawlerSourceInput[]) {
    const existingJob = async () => {
      const existing = await CrawlerJob.findOne({ actorId, requestKey }).maxTimeMS(MAX_TIME_MS).lean()
      if (existing && existing.inputHash !== inputHash) throw AppError.conflict('requestKey đã dùng cho nội dung khác', 'CRAWLER_REQUEST_CONFLICT')
      return existing
    }
    try {
      return await sourceTransaction(async session => {
        const actor = await requireActor(actorId, session)
        const existing = await CrawlerJob.findOne({ actorId, requestKey }).session(session).maxTimeMS(MAX_TIME_MS).lean()
        if (existing) {
          if (existing.inputHash !== inputHash) throw AppError.conflict('requestKey đã dùng cho nội dung khác', 'CRAWLER_REQUEST_CONFLICT')
          return existing
        }
        const resolved: CrawlerSourceInput[] = []
        for (const source of sources) resolved.push(await resolveInputSource(actorId, actor.role === 'admin', source, session, true))
        const targets = resolved.flatMap(source => source.storyId ? [source.storyId] : [])
        if (new Set(targets).size !== targets.length) throw AppError.conflict('Nhiều nguồn đang chọn cùng một truyện đích', 'CRAWLER_DUPLICATE_DESTINATION')
        const [created] = await CrawlerJob.create([{ actorId, requestKey, inputHash, sources: resolved.map(source => ({
          url: source.url, destination: source.storyId ? 'existing' : 'new', storyId: source.storyId,
          genreIds: source.genreIds ?? [], from: source.from ?? 1, to: source.to ?? 2000, startOrder: source.startOrder ?? 1,
          reusedExisting: source.reusedExisting, skipReason: source.skipReason,
          discovery: { nextUrl: source.skipReason ? undefined : source.url, visitedUrls: [], seenHashes: [], pageCount: 0, chapterCount: 0, complete: !!source.skipReason },
        })) }], { session })
        return created.toObject()
      })
    } catch (error) {
      if (!duplicate(error)) throw error
      const existing = await existingJob()
      if (existing) return existing
      throw AppError.conflict('Tài khoản đã có một đợt nhập đang hoạt động', 'CRAWLER_ACTIVE_JOB')
    }
  },

  /** Read one authorized job; admin access must be resolved from current identity by the service. */
  async findOwned(jobId: string, actorId: string, isAdmin = false) {
    const canReadAll = isAdmin && (await requireActor(actorId)).role === 'admin'
    const job = await CrawlerJob.findOne({ _id: jobId, ...(canReadAll ? {} : { actorId }) }).select(API_JOB_EXCLUSIONS).maxTimeMS(MAX_TIME_MS).lean()
    if (!job) throw AppError.notFound('Không tìm thấy đợt nhập', 'CRAWLER_JOB_NOT_FOUND')
    return job
  },

  /** Descending cursor pagination binds the cursor to the actor. */
  async list(actorId: string, query: CrawlerPageQuery) {
    const limit = Math.max(1, Math.min(query.limit, 50))
    const key = hash(`jobs:${actorId}`), cursor = decodeCursor(query.cursor)
    if (query.cursor && (!cursor || cursor.key !== key || typeof cursor.id !== 'string' || !/^[a-f\d]{24}$/i.test(cursor.id) || typeof cursor.date !== 'string' || !Number.isFinite(Date.parse(cursor.date)))) throw AppError.badRequest('Cursor không hợp lệ', 'INVALID_CURSOR')
    const condition = cursor ? { $or: [{ createdAt: { $lt: new Date(cursor.date as string) } }, { createdAt: new Date(cursor.date as string), _id: { $lt: new Types.ObjectId(cursor.id as string) } }] } : {}
    const rows = await CrawlerJob.find({ actorId, ...condition }).select(API_JOB_EXCLUSIONS).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).maxTimeMS(MAX_TIME_MS).lean()
    const items = rows.slice(0, limit), last = items.at(-1), hasMore = rows.length > limit
    return { items, meta: buildCursorMeta(limit, hasMore && last ? encodeCursor({ key, id: String(last._id), date: last.createdAt.toISOString() }) : null, hasMore) }
  },

  /** A small private destination picker projects titles only and binds cursors to actor and literal search. */
  async targets(actorId: string, query: CrawlerTargetsQuery) {
    await requireActor(actorId)
    const q = query.q?.trim() ?? ''
    if (q.length > 200) throw AppError.badRequest('Từ khóa vượt 200 ký tự', 'CRAWLER_INVALID_SEARCH')
    const limit = Math.max(1, Math.min(query.limit, 50))
    const key = hash(`targets:${actorId}:${q}`), cursor = decodeCursor(query.cursor)
    if (query.cursor && (!cursor || cursor.key !== key || typeof cursor.id !== 'string' || !/^[a-f\d]{24}$/i.test(cursor.id) || typeof cursor.date !== 'string' || !Number.isFinite(Date.parse(cursor.date)))) throw AppError.badRequest('Cursor không hợp lệ', 'INVALID_CURSOR')
    const condition = cursor ? { $or: [{ createdAt: { $lt: new Date(cursor.date as string) } }, { createdAt: new Date(cursor.date as string), _id: { $lt: new Types.ObjectId(cursor.id as string) } }] } : {}
    const title = q ? { title: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : {}
    const rows = await Story.find({ authorId: actorId, moderationStatus: { $nin: ['hidden', 'removed'] }, ...title, ...condition }).select('_id title createdAt').sort({ createdAt: -1, _id: -1 }).limit(limit + 1).maxTimeMS(3000).lean()
    const page = rows.slice(0, limit), last = page.at(-1), hasMore = rows.length > limit
    return { items: page.map(row => ({ _id: row._id, title: row.title })), meta: buildCursorMeta(limit, hasMore && last ? encodeCursor({ key, id: String(last._id), date: last.createdAt.toISOString() }) : null, hasMore) }
  },

  /** Task cursors bind both job and status filter, with no chapter content or lease data. */
  async tasks(jobId: string, query: CrawlerTaskPageQuery) {
    const limit = Math.max(1, Math.min(query.limit, 100))
    const key = hash(`tasks:${jobId}:${query.status ?? ''}`), cursor = decodeCursor(query.cursor)
    if (query.cursor && (!cursor || cursor.key !== key || typeof cursor.id !== 'string' || !/^[a-f\d]{24}$/i.test(cursor.id))) throw AppError.badRequest('Cursor không hợp lệ', 'INVALID_CURSOR')
    const rows = await CrawlerTask.find({ jobId, ...(query.status ? { status: query.status } : {}), ...(cursor ? { _id: { $gt: new Types.ObjectId(cursor.id as string) } } : {}) }).sort({ _id: 1 }).limit(limit + 1).select('-sourceHash').maxTimeMS(MAX_TIME_MS).lean()
    const items = rows.slice(0, limit), last = items.at(-1), hasMore = rows.length > limit
    return { items, meta: buildCursorMeta(limit, hasMore && last ? encodeCursor({ key, id: String(last._id) }) : null, hasMore) }
  },

  /** Claim one due job; owner must be a fresh random token for every claim generation. */
  async claim(owner: string, leaseMs = LEASE_MS) {
    const now = new Date()
    const job = await CrawlerJob.findOneAndUpdate({ active: true, status: { $in: executable }, nextRunAt: { $lte: now }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] },
      { $set: { leaseOwner: owner, leaseUntil: new Date(now.getTime() + leaseMs) } }, { new: true, sort: { nextRunAt: 1, _id: 1 }, maxTimeMS: MAX_TIME_MS }).lean()
    if (job?.status === 'queued') return CrawlerJob.findOneAndUpdate(leaseFilter(String(job._id), owner), { $set: { status: 'running' } }, { new: true, maxTimeMS: MAX_TIME_MS }).lean()
    return job
  },

  /** Renew only a currently valid lease; pause/cancel invalidate the owner immediately. */
  async heartbeat(jobId: string, owner: string, leaseMs = LEASE_MS) {
    const result = await CrawlerJob.updateOne(leaseFilter(jobId, owner), { $set: { leaseUntil: new Date(Date.now() + leaseMs) } }, { maxTimeMS: MAX_TIME_MS })
    return result.matchedCount === 1
  },

  /** Release the actor slot to the next scheduling tick without losing durable progress. */
  async release(jobId: string, owner: string, nextRunAt = new Date()) {
    const result = await CrawlerJob.updateOne(leaseFilter(jobId, owner), { $max: { nextRunAt }, $unset: { leaseOwner: 1, leaseUntil: 1 } }, { maxTimeMS: MAX_TIME_MS })
    return result.matchedCount === 1
  },

  /** Save a single bounded catalog page and selected task rows in one lease-fenced transaction. */
  async saveCatalog(jobId: string, owner: string, sourceIndex: number, patch: CrawlerCatalogPatch, tasks: CrawlerCatalogTask[]) {
    return transaction(async session => {
      const job = await fencedJob(jobId, owner, session)
      if (job.phase !== 'planning') throw AppError.conflict('Kế hoạch đã kết thúc', 'CRAWLER_STATE_CONFLICT')
      const source = job.sources[sourceIndex]
      if (!source) throw AppError.badRequest('Nguồn không hợp lệ', 'CRAWLER_INVALID_SOURCE')
      const counters = await sourceCounters(job, sourceIndex, session)
      const incoming = new Map<string, CrawlerCatalogTask>()
      for (const task of tasks) {
        if (task.position < source.from || task.position > source.to || task.order !== source.startOrder + task.position - source.from || task.order > 1000000) throw AppError.badRequest('Thứ tự chương không hợp lệ', 'CRAWLER_INVALID_ORDER')
        incoming.set(hash(task.url), task)
      }
      const existing = incoming.size ? await CrawlerTask.find({ jobId, sourceIndex, sourceHash: { $in: [...incoming.keys()] } }).select('sourceHash').session(session).maxTimeMS(MAX_TIME_MS).lean() : []
      for (const row of existing) incoming.delete(row.sourceHash)
      if (job.counters.total + incoming.size > 10000) throw AppError.badRequest('Đợt nhập vượt 10.000 chương', 'CRAWLER_JOB_LIMIT')
      if (incoming.size) await CrawlerTask.insertMany([...incoming].map(([sourceHash, task]) => ({ jobId, sourceIndex, sourceHash, ...task })), { session, ordered: true })
      let failed = 0
      if (patch.errorCode) {
        const result = await CrawlerTask.updateMany({ jobId, sourceIndex, status: 'pending' }, { $set: { status: 'failed', errorCode: patch.errorCode } }, { session, maxTimeMS: MAX_TIME_MS })
        failed = result.modifiedCount
      }
      const updatedSource = { ...source, ...patch, counters: { ...counters, total: counters.total + incoming.size, pending: counters.pending + incoming.size - failed, failed: counters.failed + failed } }
      return updateJob(jobId, owner, { $set: { [`sources.${sourceIndex}`]: updatedSource }, $inc: { 'counters.total': incoming.size, 'counters.pending': incoming.size - failed, 'counters.failed': failed } }, session)
    })
  },

  /** A plan stays active awaiting explicit rights confirmation; empty/failed plans release the actor. */
  async finishPlanning(jobId: string, owner: string) {
    return transaction(async session => {
      const job = await fencedJob(jobId, owner, session)
      if (job.phase !== 'planning' || job.sources.some(source => !source.discovery.complete && !source.errorCode)) throw AppError.conflict('Mục lục chưa được xử lý xong', 'CRAWLER_STATE_CONFLICT')
      const entirelySkipped = job.sources.every(source => !!source.skipReason)
      const ready = job.counters.total > 0 && job.sources.some(source => source.discovery.complete && !source.errorCode && !source.skipReason)
      const sources = job.sources.map(source => source.discovery.complete && !source.errorCode ? { ...source, discovery: { ...source.discovery, seenHashes: [], visitedUrls: [] } } : source)
      return updateJob(jobId, owner, { $set: { sources, status: ready ? 'ready' : entirelySkipped ? 'completed' : 'failed', active: ready, ...(ready ? {} : { finishedAt: new Date(), ...(!entirelySkipped ? { errorCode: 'CRAWLER_EMPTY_PLAN' } : {}) }) }, $unset: { leaseOwner: 1, leaseUntil: 1, ...(entirelySkipped ? { errorCode: 1 } : {}) } }, session)
    })
  },

  /** Return the next due task; no in-memory task claim survives a lease generation. */
  async nextTask(jobId: string) {
    const job = await CrawlerJob.findById(jobId).select('sources.discovery.complete sources.errorCode sources.skipReason').maxTimeMS(MAX_TIME_MS).lean()
    const sourceIndexes = job?.sources.flatMap((source, index) => source.discovery.complete && !source.errorCode && !source.skipReason ? [index] : []) ?? []
    return CrawlerTask.findOne({ jobId, sourceIndex: { $in: sourceIndexes }, status: 'pending', nextRunAt: { $lte: new Date() } }).sort({ nextRunAt: 1, sourceIndex: 1, position: 1 }).maxTimeMS(MAX_TIME_MS).lean()
  },

  /** Increment network attempts; omission of retryAt marks the task finally failed. */
  async recordTaskFailure(jobId: string, owner: string, taskId: string, errorCode: string, retryAt?: Date) {
    return transaction(async session => {
      const job = await fencedJob(jobId, owner, session)
      const task = await CrawlerTask.findOne({ _id: taskId, jobId, status: 'pending' }).session(session).maxTimeMS(MAX_TIME_MS).lean()
      if (!task) throw AppError.conflict('Chương đã được xử lý', 'CRAWLER_TASK_CONFLICT')
      const canRetry = retryAt && task.attempts < 2
      const counters = canRetry ? undefined : await sourceCounters(job, task.sourceIndex, session)
      await CrawlerTask.updateOne({ _id: taskId, jobId, status: 'pending' }, { $set: { status: canRetry ? 'pending' : 'failed', errorCode, nextRunAt: retryAt ?? new Date() }, $inc: { attempts: 1 } }, { session, maxTimeMS: MAX_TIME_MS, runValidators: true })
      return updateJob(jobId, owner, canRetry ? { $set: { nextRunAt: new Date() } } : { $set: { [`sources.${task.sourceIndex}.counters`]: { ...counters!, pending: counters!.pending - 1, failed: counters!.failed + 1 } }, $inc: { 'counters.pending': -1, 'counters.failed': 1 } }, session)
    })
  },

  /** Quota/HTTP backpressure postpones a task without consuming its retry budget. */
  async deferTask(jobId: string, owner: string, taskId: string, nextRunAt: Date, errorCode?: string) {
    return transaction(async session => {
      await fencedJob(jobId, owner, session)
      const result = await CrawlerTask.updateOne({ _id: taskId, jobId, status: 'pending' }, { $set: { nextRunAt, ...(errorCode ? { errorCode } : {}) } }, { session, maxTimeMS: MAX_TIME_MS, runValidators: true })
      if (result.matchedCount !== 1) throw AppError.conflict('Chương đã được xử lý', 'CRAWLER_TASK_CONFLICT')
    })
  },

  /** Shared-host backpressure postpones that host's pending tasks without blocking other sources or spending attempts. */
  async deferSource(jobId: string, owner: string, sourceIndex: number, nextRunAt: Date, errorCode: string) {
    return transaction(async session => {
      const job = await fencedJob(jobId, owner, session)
      if (job.phase !== 'importing' || !job.rightsConfirmedAt) throw AppError.conflict('Chưa xác nhận bắt đầu nhập', 'CRAWLER_STATE_CONFLICT')
      const source = job.sources[sourceIndex]
      if (!source) throw AppError.badRequest('Nguồn không hợp lệ', 'CRAWLER_INVALID_SOURCE')
      const hostname = new URL(source.url).hostname
      const sourceIndexes = job.sources.flatMap((candidate, index) => new URL(candidate.url).hostname === hostname ? [index] : [])
      await CrawlerTask.updateMany({ jobId, sourceIndex: { $in: sourceIndexes }, status: 'pending' }, { $max: { nextRunAt }, $set: { errorCode } }, { session, maxTimeMS: MAX_TIME_MS, runValidators: true })
    })
  },

  /** Postpone the whole job, retaining its lease until explicit release. */
  async defer(jobId: string, owner: string, nextRunAt: Date) {
    return transaction(async session => { await fencedJob(jobId, owner, session); return updateJob(jobId, owner, { $set: { nextRunAt } }, session) })
  },

  /** Create a pending destination and attach it atomically, making restart safe. */
  async ensureDestination(jobId: string, owner: string, sourceIndex: number, metadata?: CrawlerMetadata, coverBase64?: string) {
    return sourceTransaction(async session => {
      const job = await fencedJob(jobId, owner, session)
      if (job.phase !== 'importing' || !job.rightsConfirmedAt) throw AppError.conflict('Chưa xác nhận bắt đầu nhập', 'CRAWLER_STATE_CONFLICT')
      return ensureDestinationInTransaction(job, sourceIndex, session, metadata, coverBase64)
    })
  },

  /** Recheck provenance before catalog/cover/chapter fetches and skip inaccessible global duplicates. */
  async refreshSource(jobId: string, owner: string, sourceIndex: number) {
    return sourceTransaction(async session => refreshSourceInTransaction(await fencedJob(jobId, owner, session), sourceIndex, session))
  },

  /** Skip an imported URL or occupied order before fetching, without changing the existing chapter. */
  async skipExisting(jobId: string, owner: string, taskId: string): Promise<boolean> {
    return transaction(async session => {
      const job = await fencedJob(jobId, owner, session)
      if (job.phase !== 'importing' || !job.rightsConfirmedAt) throw AppError.conflict('Chưa xác nhận bắt đầu nhập', 'CRAWLER_STATE_CONFLICT')
      const task = await CrawlerTask.findOne({ _id: taskId, jobId }).session(session).maxTimeMS(MAX_TIME_MS).lean()
      if (!task) throw AppError.notFound('Không tìm thấy chương', 'CRAWLER_TASK_NOT_FOUND')
      if (task.status === 'succeeded' || task.status === 'skipped') return true
      if (task.status !== 'pending') throw AppError.conflict('Chương đã bị đánh dấu lỗi', 'CRAWLER_TASK_CONFLICT')
      const source = job.sources[task.sourceIndex]
      if (!source?.storyId) return false
      const actor = await requireActor(String(job.actorId), session)
      await requireStory(String(source.storyId), String(job.actorId), actor.role === 'admin', session, true)
      const byUrl = await Chapter.findOne({ storyId: source.storyId, slug: `crawl-${task.sourceHash}` }).select('_id order').session(session).maxTimeMS(MAX_TIME_MS).lean()
      const existing = byUrl ?? await Chapter.findOne({ storyId: source.storyId, order: task.order }).select('_id order').session(session).maxTimeMS(MAX_TIME_MS).lean()
      if (!existing) return false
      const counters = await sourceCounters(job, task.sourceIndex, session)
      const result = await CrawlerTask.updateOne({ _id: taskId, jobId, status: 'pending' }, {
        $set: { status: 'skipped', chapterId: existing._id, order: existing.order, ...(byUrl ? {} : { errorCode: 'CHAPTER_ORDER_EXISTS' }) },
        ...(byUrl ? { $unset: { errorCode: 1 } } : {}),
      }, { session, maxTimeMS: MAX_TIME_MS, runValidators: true })
      if (result.matchedCount !== 1) throw AppError.conflict('Chương đã được xử lý', 'CRAWLER_TASK_CONFLICT')
      await updateJob(jobId, owner, { $set: { [`sources.${task.sourceIndex}.counters`]: { ...counters, pending: counters.pending - 1, skipped: counters.skipped + 1 } }, $inc: { 'counters.pending': -1, 'counters.skipped': 1 } }, session)
      return true
    })
  },

  /** Commit a draft Chapter, task outcome and counters together; never overwrite existing chapter/order. */
  async commitChapter(jobId: string, owner: string, task: Pick<CrawlerTaskRecord, '_id'>, content: CrawlerChapterContent) {
    const commit = () => transaction(async session => {
      const job = await fencedJob(jobId, owner, session)
      if (job.phase !== 'importing' || !job.rightsConfirmedAt) throw AppError.conflict('Chưa xác nhận bắt đầu nhập', 'CRAWLER_STATE_CONFLICT')
      const row = await CrawlerTask.findOne({ _id: task._id, jobId }).session(session).maxTimeMS(MAX_TIME_MS).lean()
      if (!row) throw AppError.notFound('Không tìm thấy chương', 'CRAWLER_TASK_NOT_FOUND')
      if (row.status === 'succeeded' || row.status === 'skipped') return { status: row.status, chapterId: String(row.chapterId), ...(row.errorCode ? { errorCode: row.errorCode } : {}) }
      if (row.status !== 'pending') throw AppError.conflict('Chương đã bị đánh dấu lỗi', 'CRAWLER_TASK_CONFLICT')
      const counters = await sourceCounters(job, row.sourceIndex, session)
      const storyId = await ensureDestinationInTransaction(job, row.sourceIndex, session)
      if (!storyId) return { status: 'skipped' as const, errorCode: 'CRAWLER_STORY_EXISTS' }
      const slug = `crawl-${row.sourceHash}`
      const byUrl = await Chapter.findOne({ storyId, slug }).select('_id order').session(session).maxTimeMS(MAX_TIME_MS).lean()
      const existing = byUrl ?? await Chapter.findOne({ storyId, order: row.order }).select('_id order').session(session).maxTimeMS(MAX_TIME_MS).lean()
      let chapterId: Types.ObjectId, status: 'succeeded' | 'skipped'
      const errorCode = existing && !byUrl ? 'CHAPTER_ORDER_EXISTS' : undefined
      if (existing) { chapterId = existing._id; status = 'skipped' }
      else {
        const [chapter] = await Chapter.create([{ storyId, slug, title: content.title?.trim() || row.title, order: row.order, contentHtml: content.contentHtml, wordCount: content.wordCount, status: 'draft', moderationStatus: 'pending' }], { session })
        chapterId = chapter._id; status = 'succeeded'
      }
      const result = await CrawlerTask.updateOne({ _id: row._id, jobId, status: 'pending' }, {
        $set: { status, chapterId, ...(existing ? { order: existing.order } : {}), ...(errorCode ? { errorCode } : {}) },
        ...(!errorCode ? { $unset: { errorCode: 1 } } : {}),
      }, { session, maxTimeMS: MAX_TIME_MS, runValidators: true })
      if (result.matchedCount !== 1) throw AppError.conflict('Chương đã được xử lý', 'CRAWLER_TASK_CONFLICT')
      await updateJob(jobId, owner, { $set: { [`sources.${row.sourceIndex}.counters`]: { ...counters, pending: counters.pending - 1, [status]: counters[status] + 1 } }, $inc: { 'counters.pending': -1, [`counters.${status}`]: 1 } }, session)
      return { status, chapterId: String(chapterId), ...(errorCode ? { errorCode } : {}) }
    })
    try { return await commit() }
    catch (error) {
      if (!duplicate(error)) throw error
      // A legacy single-chapter import can bypass the parent fence; reload in a fresh snapshot.
      try { return await commit() }
      catch (retryError) {
        if (duplicate(retryError)) throw new AppError(503, 'Chương đang được ghi đồng thời. Sẽ kiểm tra lại trước khi nhập.', 'CRAWLER_STORAGE_UNAVAILABLE')
        throw retryError
      }
    }
  },

  /** State transitions serialize on the job and instantly fence an old worker on pause/cancel. */
  async control(jobId: string, actorId: string, action: CrawlerControlAction, rightsConfirmed = false, isAdmin = false) {
    try {
      return await transaction(async session => {
        const actor = await requireActor(actorId, session)
        const job = await CrawlerJob.findOne({ _id: jobId, ...(isAdmin && actor.role === 'admin' ? {} : { actorId }) }).session(session).maxTimeMS(MAX_TIME_MS).lean()
        if (!job) throw AppError.notFound('Không tìm thấy đợt nhập', 'CRAWLER_JOB_NOT_FOUND')
        const set: Record<string, unknown> = { nextRunAt: new Date() }
        const unset: Record<string, number> = { leaseOwner: 1, leaseUntil: 1, errorCode: 1, finishedAt: 1 }
        if (action === 'start') {
          if (job.status !== 'ready') throw AppError.conflict('Chỉ bắt đầu kế hoạch đã sẵn sàng', 'CRAWLER_STATE_CONFLICT')
          if (!rightsConfirmed) throw AppError.badRequest('Cần xác nhận quyền sử dụng nội dung', 'CRAWLER_RIGHTS_REQUIRED')
          for (const source of job.sources) if (!source.storyId && !source.errorCode && !source.skipReason) { assertMetadata(source.metadata); await requireGenres(source.genreIds, session) }
          Object.assign(set, { status: 'queued', phase: 'importing', rightsConfirmedAt: new Date() })
        } else if (action === 'pause') {
          if (!executable.includes(job.status)) throw AppError.conflict('Công việc không thể tạm dừng', 'CRAWLER_STATE_CONFLICT')
          set.status = 'paused'
        } else if (action === 'resume') {
          if (job.status !== 'paused') throw AppError.conflict('Công việc chưa tạm dừng', 'CRAWLER_STATE_CONFLICT')
          set.status = job.phase === 'planning' ? 'planning' : 'queued'
        } else if (action === 'cancel') {
          if (!job.active) throw AppError.conflict('Công việc đã kết thúc', 'CRAWLER_STATE_CONFLICT')
          Object.assign(set, { status: 'cancelled', active: false, finishedAt: new Date() }); delete unset.finishedAt
        } else if (action === 'retry') {
          if (!['completed_with_errors', 'failed'].includes(job.status)) throw AppError.conflict('Công việc không có lỗi để thử lại', 'CRAWLER_STATE_CONFLICT')
          const sources: CrawlerSource[] = []
          for (let index = 0; index < job.sources.length; index++) {
            const source = job.sources[index], counters = await sourceCounters(job, index, session)
            sources.push({ ...source, counters: { ...counters, pending: counters.pending + counters.failed, failed: 0 } })
          }
          await CrawlerTask.updateMany({ jobId, status: 'failed' }, { $set: { status: 'pending', attempts: 0, nextRunAt: new Date() }, $unset: { errorCode: 1 } }, { session, maxTimeMS: MAX_TIME_MS })
          const needsPlanning = job.phase === 'planning' || job.sources.some(source => source.errorCode)
          Object.assign(set, { status: needsPlanning ? 'planning' : 'queued', phase: needsPlanning ? 'planning' : 'importing', active: true, 'counters.pending': job.counters.pending + job.counters.failed, 'counters.failed': 0 })
          set.sources = needsPlanning ? sources.map(source => source.errorCode ? { ...source, errorCode: undefined, discovery: { ...source.discovery, complete: false, attempts: 0 } } : source) : sources
        }
        if (['start', 'resume', 'retry'].includes(action)) {
          const originalActor = job.actorId.equals(actor._id) ? actor : await requireActor(String(job.actorId), session)
          for (const source of job.sources) if (source.storyId) await requireStory(String(source.storyId), String(job.actorId), originalActor.role === 'admin', session, true)
        }
        const updated = await CrawlerJob.findOneAndUpdate({ _id: jobId, status: job.status, active: job.active }, { $set: set, $unset: unset }, { session, new: true, runValidators: true, maxTimeMS: MAX_TIME_MS }).lean()
        if (!updated) throw AppError.conflict('Trạng thái công việc đã thay đổi', 'CRAWLER_STATE_CONFLICT')
        return updated
      })
    } catch (error) {
      if (duplicate(error)) throw AppError.conflict('Tài khoản đã có một đợt nhập đang hoạt động', 'CRAWLER_ACTIVE_JOB')
      throw error
    }
  },

  /** Future pending tasks reschedule the job; a terminal state is committed only after the last task. */
  async finishImport(jobId: string, owner: string) {
    return transaction(async session => {
      const job = await fencedJob(jobId, owner, session)
      if (job.phase !== 'importing') throw AppError.conflict('Công việc chưa nhập chương', 'CRAWLER_STATE_CONFLICT')
      const pending = await CrawlerTask.findOne({ jobId, status: 'pending' }).sort({ nextRunAt: 1 }).select('nextRunAt').session(session).maxTimeMS(MAX_TIME_MS).lean()
      if (pending) return updateJob(jobId, owner, { $set: { nextRunAt: pending.nextRunAt }, $unset: { leaseOwner: 1, leaseUntil: 1 } }, session)
      const hasErrors = job.counters.failed > 0 || job.sources.some(source => source.errorCode)
      return updateJob(jobId, owner, { $set: { status: hasErrors ? 'completed_with_errors' : 'completed', active: false, finishedAt: new Date() }, $unset: { leaseOwner: 1, leaseUntil: 1 } }, session)
    })
  },

  /** Stop a permanently unusable job, even when its actor permission has been revoked. */
  async failJob(jobId: string, owner: string, errorCode: string) {
    return transaction(async session => {
      await fencedJob(jobId, owner, session, false)
      return updateJob(jobId, owner, { $set: { status: 'failed', active: false, finishedAt: new Date(), errorCode }, $unset: { leaseOwner: 1, leaseUntil: 1 } }, session)
    })
  },
}
