import mongoose, { Types, type ClientSession } from 'mongoose'
import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { AppError } from '../common/AppError.js'
import { Story, type IStory } from '../models/Story.model.js'
import { CrawlerStorySource, type CrawlerStorySourceRecord } from '../models/CrawlerStorySource.model.js'

const MAX_TIME_MS = 5000
const identityConflict = () => AppError.conflict('Nguồn truyện đã được liên kết với một truyện khác', 'CRAWLER_SOURCE_CONFLICT')
const storyExists = () => AppError.conflict('Truyện từ nguồn này đã tồn tại. Hãy dùng chức năng nhập chương vào truyện đã có.', 'CRAWLER_STORY_EXISTS')
const duplicate = (error: unknown): error is { code: number; keyPattern?: Record<string, unknown>; message?: string } =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000

/** Stable exact-URL identity; configured source allowlists remain the caller's responsibility. */
export function crawlerStorySourceIdentity(rawUrl: string): { sourceUrl: string; sourceHash: string } {
  let url: URL
  try {
    if (typeof rawUrl !== 'string' || rawUrl.length > 2048) throw new Error('Invalid source URL')
    url = new URL(rawUrl)
  } catch { throw AppError.badRequest('URL nguồn truyện không hợp lệ', 'CRAWLER_URL') }
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(hostname)) {
    throw AppError.badRequest('Nguồn truyện phải dùng HTTPS, không có thông tin đăng nhập, IP hoặc cổng khác 443', 'CRAWLER_URL')
  }
  url.hash = ''
  if (url.href.length > 2048) throw AppError.badRequest('URL nguồn truyện vượt giới hạn 2.048 ký tự', 'CRAWLER_URL')
  return { sourceUrl: url.href, sourceHash: createHash('sha256').update(url.href).digest('hex') }
}

/** Private provenance storage. Callers must authorize the actor and destination before binding. */
export const crawlerStorySourceRepository = {
  identity: crawlerStorySourceIdentity,

  /** Create development indexes; production verifies the required global uniqueness without writes. */
  async initialize(production = process.env.NODE_ENV === 'production') {
    if (!production) { await CrawlerStorySource.init(); return }
    let indexes: Awaited<ReturnType<typeof CrawlerStorySource.listIndexes>>
    try { indexes = await CrawlerStorySource.listIndexes() }
    catch { throw new AppError(503, 'Chưa chuẩn bị indexes nguồn truyện', 'CRAWLER_INDEXES_MISSING') }
    for (const [keys, options] of CrawlerStorySource.schema.indexes()) {
      const actual = indexes.find(index => index.name === options.name && JSON.stringify(index.key) === JSON.stringify(keys))
      if (!actual || !!actual.unique !== !!options.unique || actual.sparse || actual.partialFilterExpression) {
        throw new AppError(503, 'Indexes nguồn truyện chưa đúng hợp đồng', 'CRAWLER_INDEXES_MISSING')
      }
    }
  },

  /** Find provenance by normalized URL, optionally within the caller's transaction snapshot. */
  async find(rawUrl: string, session?: ClientSession): Promise<CrawlerStorySourceRecord | null> {
    const identity = crawlerStorySourceIdentity(rawUrl)
    const query = CrawlerStorySource.findOne({ sourceHash: identity.sourceHash }).maxTimeMS(MAX_TIME_MS)
    if (session) query.session(session)
    const mapping = await query.lean()
    if (mapping && mapping.sourceUrl !== identity.sourceUrl) throw identityConflict()
    return mapping
  },

  /** Bind in the caller's active transaction; duplicate-key races must restart that whole transaction. */
  async bind(rawUrl: string, storyId: string | Types.ObjectId, session: ClientSession): Promise<CrawlerStorySourceRecord> {
    if (!session.inTransaction()) throw new AppError(503, 'Liên kết nguồn cần giao dịch đang hoạt động', 'CRAWLER_STORAGE_UNAVAILABLE')
    if (!Types.ObjectId.isValid(storyId)) throw AppError.badRequest('ID truyện không hợp lệ', 'CRAWLER_INVALID_STORY')
    const identity = crawlerStorySourceIdentity(rawUrl)
    const existing = await crawlerStorySourceRepository.find(identity.sourceUrl, session)
    if (existing) {
      if (String(existing.storyId) !== String(storyId)) throw identityConflict()
      return existing
    }
    // E11000 aborts a MongoDB transaction. Never swallow it and continue using that session.
    const [mapping] = await CrawlerStorySource.create([{ ...identity, storyId }], { session })
    return mapping.toObject()
  },

  /** Create a normal form Story and its provenance atomically, never leaving an orphan on conflict. */
  async createStory(data: Partial<IStory>, rawUrl: string): Promise<IStory> {
    const identity = crawlerStorySourceIdentity(rawUrl)
    await crawlerStorySourceRepository.initialize()
    const session = await mongoose.startSession()
    try {
      return await session.withTransaction(async () => {
        if (await crawlerStorySourceRepository.find(identity.sourceUrl, session)) throw storyExists()
        const [story] = await Story.create([data], { session })
        await crawlerStorySourceRepository.bind(identity.sourceUrl, story._id, session)
        return story
      }, { maxCommitTimeMS: MAX_TIME_MS, timeoutMS: 15000, readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }) as IStory
    } catch (error) {
      if (!duplicate(error)) throw error
      // One bounded read after rollback identifies a provenance race without exposing its Story ID.
      if (error.keyPattern?.sourceHash || error.message?.includes('crawler_story_source_identity') ||
          await crawlerStorySourceRepository.find(identity.sourceUrl)) throw storyExists()
      throw error
    } finally { await session.endSession() }
  },
}
