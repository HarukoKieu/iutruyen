import { createHash } from 'node:crypto'
import { AppError } from '../../common/AppError.js'
import { logger } from '../../common/logger.js'
import { crawlerJobRepository } from '../../repositories/crawler-job.repository.js'
import type { CrawlerJobRecord } from '../../models/CrawlerJob.model.js'
import { crawlerCache } from './crawler.cache.js'
import { normalizeSourceUrl, resolveSource } from './crawler.config.js'
import { fetchCrawlerHtml } from './crawler.transport.js'
import { parseChapter, textToChapterHtml } from './crawler.parser.js'
import { parseCrawlerJobPage } from './crawler-job.parser.js'
import { createStorySchema } from '../stories/stories.validation.js'
import { crawlerJobCreateSchema, type CrawlerJobCreateInput, type CrawlerJobControlInput, type CrawlerJobsQuery, type CrawlerTasksQuery, type CrawlerTargetsQuery } from './crawler-job.validation.js'

export function crawlerJobDto(job: CrawlerJobRecord) {
  return { id: String(job._id), actorId: String(job.actorId), status: job.status, phase: job.phase,
    active: job.active, counters: job.counters, createdAt: job.createdAt, updatedAt: job.updatedAt,
    finishedAt: job.finishedAt, errorCode: job.errorCode,
    sources: job.sources.map(source => ({ url: source.url, destination: source.destination,
      storyId: source.storyId ? String(source.storyId) : undefined, genreIds: source.genreIds.map(String),
      from: source.from, to: source.to, startOrder: source.startOrder, metadata: source.metadata,
      reusedExisting: source.reusedExisting, skipReason: source.skipReason,
      counters: source.counters ?? { total: 0, pending: 0, succeeded: 0, skipped: 0, failed: 0 },
      discovery: { nextUrl: source.discovery.nextUrl, pageCount: source.discovery.pageCount,
        chapterCount: source.discovery.chapterCount, complete: source.discovery.complete },
      warning: source.warning, errorCode: source.errorCode })) }
}

const repository = crawlerJobRepository
export const crawlerJobService = {
  async targets(actorId: string, query: CrawlerTargetsQuery) {
    const result = await repository.targets(actorId, query)
    return { items: result.items.map(story => ({ id: String(story._id), title: story.title })), meta: result.meta }
  },
  async create(actorId: string, rawInput: CrawlerJobCreateInput) {
    const input = crawlerJobCreateSchema.parse(rawInput)
    await repository.initialize()
    const sources = input.sources.map(item => {
      const url = new URL(item.url); url.hash = ''
      return { ...item, url: url.href, destination: item.storyId ? 'existing' as const : 'new' as const, genreIds: item.genreIds ?? [] }
    })
    const hash = createHash('sha256').update(JSON.stringify(sources)).digest('hex')
    const previous = await repository.findRequest(actorId, input.requestKey, hash)
    if (previous) return crawlerJobDto(previous)
    const resolved = await repository.resolveSources(actorId, sources)
    for (const item of resolved) {
      const { source } = resolveSource(item.url)
      if (!item.storyId && !item.skipReason && !source.storySelectors) throw AppError.badRequest('Nguồn chưa cấu hình thông tin truyện. Hãy chọn truyện đã có.', 'CRAWLER_EMPTY_STORY')
    }
    const job = await repository.enqueue(actorId, input.requestKey, hash, resolved)
    logger.info('crawler.batch.prepared', { actorId, jobId: String(job._id), sourceCount: sources.length })
    return crawlerJobDto(job)
  },
  async list(actorId: string, query: CrawlerJobsQuery) {
    const result = await repository.list(actorId, query)
    return { items: result.items.map(crawlerJobDto), meta: result.meta }
  },
  async detail(actorId: string, jobId: string, isAdmin = false) { return crawlerJobDto(await repository.findOwned(jobId, actorId, isAdmin)) },
  async tasks(actorId: string, jobId: string, query: CrawlerTasksQuery, isAdmin = false) {
    await repository.findOwned(jobId, actorId, isAdmin)
    const result = await repository.tasks(jobId, query)
    return { items: result.items.map(task => ({ id: String(task._id), sourceIndex: task.sourceIndex,
      title: task.title, url: task.url, position: task.position, order: task.order, status: task.status,
      attempts: task.attempts, errorCode: task.errorCode, chapterId: task.chapterId ? String(task.chapterId) : undefined })), meta: result.meta }
  },
  async control(actorId: string, jobId: string, input: CrawlerJobControlInput, isAdmin = false) {
    const job = await repository.control(jobId, actorId, input.action, input.rightsConfirmed === true, isAdmin)
    logger.info('crawler.batch.control', { actorId, jobId, action: input.action, rightsConfirmed: input.rightsConfirmed === true })
    return crawlerJobDto(job)
  },
}

/** One bounded unit per claim allows jobs to yield while waiting for upstream quota/cooldown. */
export function createCrawlerJobProcessor(repo = repository, fetchHtml = fetchCrawlerHtml, quota = crawlerCache.quota) {
  async function plan(job: CrawlerJobRecord, owner: string, signal: AbortSignal) {
    const index = job.sources.findIndex(source => !source.discovery.complete && !source.errorCode)
    if (index < 0) { await repo.finishPlanning(String(job._id), owner); return }
    let item = job.sources[index]
    try {
      item = await repo.refreshSource(String(job._id), owner, index)
      if (item.skipReason) return
      const discovery = { ...item.discovery, visitedUrls: [...item.discovery.visitedUrls], seenHashes: [...item.discovery.seenHashes] }
      const urlString = discovery.nextUrl ?? item.url
      if (discovery.visitedUrls.includes(urlString)) throw AppError.badRequest('Mục lục bị lặp trang', 'CRAWLER_PAGINATION_LOOP')
      if (discovery.pageCount >= 100) throw AppError.badRequest('Mục lục vượt 100 trang', 'CRAWLER_PAGINATION_LIMIT')
      await repo.validateTargets(String(job.actorId), [{ ...item, storyId: item.storyId ? String(item.storyId) : undefined, genreIds: item.genreIds.map(String) }])
      await quota(String(job.actorId))
      const { source, url } = resolveSource(urlString)
      const page = parseCrawlerJobPage(await fetchHtml(url, false, signal), url, source)
      signal.throwIfAborted()
      const metadata = item.metadata ?? (page.metadata && page.metadata.description ? { title: page.metadata.title, description: page.metadata.description,
        originalAuthor: page.metadata.author, sourceName: source.hostname, genres: page.metadata.genres.slice(0, 20).map(name => name.slice(0, 100)),
        status: page.metadata.status, coverUrl: page.metadata.coverUrl } : undefined)
      if (item.destination === 'new' && !item.metadata) {
        if (!metadata) throw AppError.badRequest('Không tìm thấy thông tin truyện mới', 'CRAWLER_EMPTY_STORY')
        const valid = createStorySchema.safeParse({ ...metadata, genreIds: item.genreIds.map(String) })
        if (!valid.success) throw AppError.badRequest('Tên hoặc giới thiệu nguồn không đáp ứng yêu cầu tạo truyện. Hãy tạo truyện thủ công và chọn làm đích.', 'CRAWLER_STORY_VALIDATION')
      }
      const seen = new Set(discovery.seenHashes)
      const tasks: { url: string; title: string; position: number; order: number }[] = []
      let consumedLinks = 0
      for (const chapter of page.chapters) {
        consumedLinks++
        const hash = createHash('sha256').update(chapter.url).digest('hex')
        if (seen.has(hash)) continue
        seen.add(hash); discovery.chapterCount++
        if (discovery.chapterCount > 2000) throw AppError.badRequest('Truyện vượt giới hạn 2.000 chương mỗi đợt', 'CRAWLER_CATALOG_LIMIT')
        if (discovery.chapterCount >= item.from && discovery.chapterCount <= (item.to ?? 2000)) {
          tasks.push({ ...chapter, position: discovery.chapterCount, order: item.startOrder + discovery.chapterCount - item.from })
        }
        if (discovery.chapterCount >= item.to) break
      }
      const rangeComplete = discovery.chapterCount >= item.to
      if (page.truncated && !rangeComplete) throw AppError.badRequest('Trang mục lục quá lớn để xác định đủ phạm vi đã chọn', 'CRAWLER_CATALOG_LIMIT')
      if (job.counters.total + tasks.length > 10000) throw AppError.badRequest('Đợt nhập vượt giới hạn 10.000 chương', 'CRAWLER_BATCH_LIMIT')
      discovery.seenHashes = [...seen]
      discovery.attempts = 0
      discovery.visitedUrls.push(url.href); discovery.pageCount++
      if (!rangeComplete && page.nextUrl && discovery.visitedUrls.includes(page.nextUrl)) throw AppError.badRequest('Mục lục bị lặp trang', 'CRAWLER_PAGINATION_LOOP')
      discovery.nextUrl = rangeComplete ? undefined : page.nextUrl
      discovery.complete = rangeComplete || !page.nextUrl
      if (discovery.complete && discovery.chapterCount < item.from) throw AppError.badRequest('Khoảng chương đã chọn nằm ngoài mục lục', 'CRAWLER_RANGE_EMPTY')
      const limitedRange = rangeComplete && (page.nextUrl || page.truncated || page.chapters.length > consumedLinks)
      const warning = limitedRange ? `Đã lấy đến vị trí ${item.to} theo phạm vi đã chọn. Nguồn có thể còn chương ngoài phạm vi này.` : page.warning
      await repo.saveCatalog(String(job._id), owner, index, { metadata, discovery, warning }, tasks)
    } catch (error) {
      if (signal.aborted) throw error
      const appError = error instanceof AppError ? error : undefined
      if (!appError) throw new AppError(503, 'Lưu kế hoạch tạm thời không khả dụng', 'CRAWLER_STORAGE_UNAVAILABLE')
      if (appError?.code === 'CRAWLER_LEASE_LOST') throw error
      if (appError?.statusCode === 429 || appError?.statusCode === 503) throw error
      if (appError?.statusCode === 502 && (item.discovery.attempts ?? 0) < 2) {
        await repo.saveCatalog(String(job._id), owner, index, { discovery: { ...item.discovery, attempts: (item.discovery.attempts ?? 0) + 1 } }, [])
        throw new AppError(503, 'Đang chờ thử lại mục lục', 'CRAWLER_RETRY_PAGE')
      }
      await repo.saveCatalog(String(job._id), owner, index, { discovery: item.discovery, errorCode: appError?.code ?? 'CRAWLER_PLANNING_FAILED' }, [])
    }
  }

  async function destination(job: CrawlerJobRecord, owner: string, index: number, signal: AbortSignal) {
    const item = await repo.refreshSource(String(job._id), owner, index)
    if (item.skipReason) return undefined
    if (item.storyId) return String(item.storyId)
    let cover: string | undefined
    if (item.metadata?.coverUrl) {
      try {
        const { source } = resolveSource(item.url)
        const target = new URL(item.metadata.coverUrl)
        if (![source.hostname, ...(source.imageHosts ?? [])].includes(target.hostname)) throw AppError.badRequest('Ảnh bìa không thuộc nguồn được phép')
        const safe = normalizeSourceUrl(target.href, target.hostname)
        await quota(String(job.actorId))
        cover = await fetchHtml(safe, true, signal)
      } catch (error) {
        if (signal.aborted) throw error
        // Cover is optional; content importing can continue when its image server is unavailable.
      }
    }
    signal.throwIfAborted()
    return repo.ensureDestination(String(job._id), owner, index, item.metadata, cover)
  }

  async function importNext(job: CrawlerJobRecord, owner: string, signal: AbortSignal) {
    const task = await repo.nextTask(String(job._id))
    if (!task) { await repo.finishImport(String(job._id), owner); return }
    try {
      const item = job.sources[task.sourceIndex]
      if (!item || !item.discovery.complete || item.errorCode) throw AppError.badRequest('Mục lục nguồn chưa sẵn sàng', 'CRAWLER_CATALOG_INCOMPLETE')
      if (!await destination(job, owner, task.sourceIndex, signal)) return { continueImmediately: true }
      if (await repo.skipExisting(String(job._id), owner, String(task._id))) return { continueImmediately: true }
      await quota(String(job.actorId))
      const { source, url } = resolveSource(task.url)
      const chapter = parseChapter(await fetchHtml(url, false, signal), source)
      signal.throwIfAborted()
      await repo.commitChapter(String(job._id), owner, task, { title: chapter.title,
        contentHtml: textToChapterHtml(chapter.text), wordCount: chapter.wordCount })
    } catch (error) {
      if (signal.aborted) throw error
      if (error instanceof AppError && error.code === 'CRAWLER_LEASE_LOST') throw error
      const appError = error instanceof AppError ? error : undefined
      if (!appError) throw new AppError(503, 'Lưu tiến độ tạm thời không khả dụng', 'CRAWLER_STORAGE_UNAVAILABLE')
      const code = appError?.code ?? 'CRAWLER_IMPORT_FAILED'
      if (appError?.statusCode === 429 || appError?.statusCode === 503) {
        const delay = appError.retryAfterSeconds ? appError.retryAfterSeconds * 1000 : code === 'CRAWLER_SOURCE_BUSY' ? 2100 : appError.statusCode === 429 ? 60000 : 15000
        const retryAt = new Date(Date.now() + delay)
        if (code === 'CRAWLER_SOURCE_BUSY' || code === 'CRAWLER_UPSTREAM_RATE_LIMITED' || code === 'CRAWLER_UPSTREAM_UNAVAILABLE') {
          await repo.deferSource(String(job._id), owner, task.sourceIndex, retryAt, code)
        } else if (code === 'CRAWLER_QUOTA' || appError.statusCode === 503) await repo.defer(String(job._id), owner, retryAt)
        else await repo.deferTask(String(job._id), owner, String(task._id), retryAt, code)
      } else {
        const retry = appError?.statusCode === 502 && task.attempts < 2
        await repo.recordTaskFailure(String(job._id), owner, String(task._id), code, retry ? new Date(Date.now() + 2000 * 2 ** task.attempts) : undefined)
      }
    }
  }
  return {
    async process(job: CrawlerJobRecord, owner: string, signal: AbortSignal) {
      await repo.assertActor(String(job.actorId))
      signal.throwIfAborted()
      if (job.phase === 'planning') return plan(job, owner, signal)
      return importNext(job, owner, signal)
    },
  }
}
