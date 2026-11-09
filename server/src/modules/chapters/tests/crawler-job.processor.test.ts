import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CrawlerJobRecord } from '../../../models/CrawlerJob.model.js'
const mocked = vi.hoisted(() => ({ source: { hostname: 'books.example.org', titleSelector: 'h1', contentSelector: 'article', chapterLinkSelector: '.toc a', nextCatalogSelector: '.next' } }))
vi.mock('../../../config/env.js', () => ({ env: { CRAWLER_SOURCES_JSON: JSON.stringify([mocked.source]) } }))
vi.mock('../../../repositories/crawler-job.repository.js', () => ({ crawlerJobRepository: {} }))
vi.mock('../crawler.cache.js', () => ({ crawlerCache: { quota: vi.fn() } }))
vi.mock('../crawler.transport.js', () => ({ fetchCrawlerHtml: vi.fn() }))
vi.mock('../../../common/logger.js', () => ({ logger: { info: vi.fn() } }))
import { createCrawlerJobProcessor, crawlerJobDto } from '../crawler-job.service.js'
import { AppError } from '../../../common/AppError.js'
import { crawlerJobRepository } from '../../../repositories/crawler-job.repository.js'

const repo = {
  assertActor: vi.fn(), validateTargets: vi.fn(), refreshSource: vi.fn(), saveCatalog: vi.fn(), finishPlanning: vi.fn(), nextTask: vi.fn(),
  ensureDestination: vi.fn(), skipExisting: vi.fn(), commitChapter: vi.fn(), deferTask: vi.fn(), deferSource: vi.fn(), defer: vi.fn(), recordTaskFailure: vi.fn(), finishImport: vi.fn(),
}
const fetch = vi.fn(), quota = vi.fn()
function job(phase: 'planning' | 'importing' = 'planning'): CrawlerJobRecord {
  return { _id: 'job', actorId: 'actor', phase, status: 'planning', active: true,
    leaseOwner: 'secret', inputHash: 'secret', requestKey: 'secret', counters: { total: 0, pending: 0, succeeded: 0, skipped: 0, failed: 0 },
    sources: [{ url: 'https://books.example.org/story', destination: 'existing', storyId: 'story', genreIds: [], from: 2, to: 3, startOrder: 10,
      discovery: { nextUrl: 'https://books.example.org/story', visitedUrls: [], seenHashes: [], pageCount: 0, chapterCount: 0, complete: phase === 'importing' } }],
  } as unknown as CrawlerJobRecord
}
const processor = createCrawlerJobProcessor(repo as unknown as typeof crawlerJobRepository, fetch, quota)
beforeEach(() => {
  vi.clearAllMocks(); repo.assertActor.mockResolvedValue({}); repo.validateTargets.mockResolvedValue(undefined)
  repo.nextTask.mockResolvedValue({ _id: 'task', sourceIndex: 0, url: 'https://books.example.org/c2', attempts: 0 })
  fetch.mockResolvedValue('<div class="toc"><a href="/c1">C1</a><a href="/c2">C2</a><a href="/c3">C3</a></div>')
  quota.mockReset().mockResolvedValue(undefined)
  repo.skipExisting.mockReset().mockResolvedValue(false)
  repo.refreshSource.mockReset().mockResolvedValue(job().sources[0])
})
describe('bulk processing commits bounded steps', () => {
  it('plans only selected positions and preserves target numbering', async () => {
    await processor.process(job(), 'owner', new AbortController().signal)
    expect(repo.saveCatalog).toHaveBeenCalledWith('job', 'owner', 0, expect.objectContaining({ discovery: expect.objectContaining({ complete: true, chapterCount: 3 }) }), [
      { url: 'https://books.example.org/c2', title: 'C2', position: 2, order: 10 },
      { url: 'https://books.example.org/c3', title: 'C3', position: 3, order: 11 },
    ])
    expect(repo.commitChapter).not.toHaveBeenCalled()
  })
  it('detects cycles before committing misleading partial pages', async () => {
    fetch.mockResolvedValue('<div class="toc"><a href="/c2">C2</a></div><a class="next" href="/story">Tiếp</a>')
    await processor.process(job(), 'owner', new AbortController().signal)
    expect(repo.saveCatalog).toHaveBeenCalledWith('job', 'owner', 0, expect.objectContaining({ errorCode: 'CRAWLER_PAGINATION_LOOP' }), [])
  })
  it('stops at the selected range without fetching unrelated pages from a large novel', async () => {
    fetch.mockResolvedValue(`<div class="toc">${Array.from({ length: 2001 }, (_, i) => `<a href="/c${i + 1}">C${i + 1}</a>`).join('')}</div><a class="next" href="?page=2">Tiếp</a>`)
    await processor.process(job(), 'owner', new AbortController().signal)
    expect(repo.saveCatalog).toHaveBeenCalledWith('job', 'owner', 0,
      expect.objectContaining({ discovery: expect.objectContaining({ complete: true, chapterCount: 3, nextUrl: undefined }), warning: expect.stringContaining('phạm vi đã chọn') }),
      expect.arrayContaining([expect.objectContaining({ position: 2, order: 10 }), expect.objectContaining({ position: 3, order: 11 })]))
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('leaves jobs eligible for retry when quota is exhausted', async () => {
    quota.mockRejectedValue(AppError.tooManyRequests('Quota', 'CRAWLER_QUOTA'))
    await expect(processor.process(job(), 'owner', new AbortController().signal)).rejects.toMatchObject({ statusCode: 429 })
    expect(fetch).not.toHaveBeenCalled(); expect(repo.saveCatalog).not.toHaveBeenCalled()
  })
  it('checks current actor before fetching', async () => {
    repo.assertActor.mockRejectedValueOnce(AppError.forbidden('Revoked'))
    await expect(processor.process(job(), 'owner', new AbortController().signal)).rejects.toMatchObject({ statusCode: 403 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('commits escaped content through the fenced repository', async () => {
    fetch.mockResolvedValue('<h1>Chương hai</h1><article>Nội dung &lt;script&gt; không được thực thi.</article>')
    await processor.process(job('importing'), 'owner', new AbortController().signal)
    expect(repo.commitChapter).toHaveBeenCalledWith('job', 'owner', expect.any(Object), expect.objectContaining({ contentHtml: expect.stringContaining('&lt;script&gt;'), title: 'Chương hai' }))
  })
  it('skips saved source URLs or occupied chapter orders before spending quota or downloading chapters', async () => {
    repo.skipExisting.mockResolvedValueOnce(true)
    await processor.process(job('importing'), 'owner', new AbortController().signal)
    expect(fetch).not.toHaveBeenCalled(); expect(quota).not.toHaveBeenCalled(); expect(repo.commitChapter).not.toHaveBeenCalled()
  })
  it('skips a foreign global story before catalog metadata or cover requests', async () => {
    repo.refreshSource.mockResolvedValue({ ...job().sources[0], storyId: undefined, skipReason: 'CRAWLER_STORY_EXISTS', discovery: { ...job().sources[0].discovery, complete: true } })
    await processor.process(job(), 'owner', new AbortController().signal)
    await processor.process(job('importing'), 'owner', new AbortController().signal)
    expect(fetch).not.toHaveBeenCalled(); expect(quota).not.toHaveBeenCalled(); expect(repo.ensureDestination).not.toHaveBeenCalled()
  })
  it('defers temporary failures without spending chapter retry attempts', async () => {
    fetch.mockRejectedValueOnce(new AppError(503, 'Redis unavailable', 'CRAWLER_UNAVAILABLE'))
    await processor.process(job('importing'), 'owner', new AbortController().signal)
    expect(repo.defer).toHaveBeenCalledWith('job', 'owner', expect.any(Date))
    expect(repo.recordTaskFailure).not.toHaveBeenCalled()
  })
  it('bounds network retries and retains permanent errors for manual retry', async () => {
    fetch.mockRejectedValueOnce(new AppError(502, 'Network', 'CRAWLER_FETCH_FAILED'))
    await processor.process(job('importing'), 'owner', new AbortController().signal)
    expect(repo.recordTaskFailure).toHaveBeenLastCalledWith('job', 'owner', 'task', 'CRAWLER_FETCH_FAILED', expect.any(Date))
    repo.nextTask.mockResolvedValueOnce({ _id: 'task', sourceIndex: 0, url: 'https://books.example.org/c2', attempts: 2 })
    fetch.mockRejectedValueOnce(new AppError(502, 'Network', 'CRAWLER_FETCH_FAILED'))
    await processor.process(job('importing'), 'owner', new AbortController().signal)
    expect(repo.recordTaskFailure).toHaveBeenLastCalledWith('job', 'owner', 'task', 'CRAWLER_FETCH_FAILED', undefined)
  })
  it('reschedules uncertain database commits without declaring a chapter permanently failed', async () => {
    fetch.mockResolvedValue('<h1>Tên</h1><article>Text</article>')
    repo.commitChapter.mockRejectedValueOnce(new Error('Database unavailable'))
    await expect(processor.process(job('importing'), 'owner', new AbortController().signal)).rejects.toMatchObject({ statusCode: 503, code: 'CRAWLER_STORAGE_UNAVAILABLE' })
    expect(repo.recordTaskFailure).not.toHaveBeenCalled()
  })
  it('never commits after shutdown aborts an in-flight download', async () => {
    const control = new AbortController()
    fetch.mockImplementationOnce(async () => { control.abort(); return '<h1>Tên</h1><article>Text</article>' })
    await expect(processor.process(job('importing'), 'owner', control.signal)).rejects.toBeDefined()
    expect(repo.commitChapter).not.toHaveBeenCalled(); expect(repo.recordTaskFailure).not.toHaveBeenCalled()
  })
  it('redacts internal queue tokens and large discovery arrays from DTOs', () => {
    const dto = crawlerJobDto(job())
    expect(dto).not.toHaveProperty('leaseOwner'); expect(dto).not.toHaveProperty('requestKey')
    expect(dto.sources[0].discovery).not.toHaveProperty('seenHashes'); expect(dto.sources[0].discovery).not.toHaveProperty('visitedUrls')
  })
})
