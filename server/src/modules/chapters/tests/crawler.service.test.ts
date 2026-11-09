import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  cache: new Map<string, unknown>(),
  findStory: vi.fn(), bySlug: vi.fn(), byOrder: vi.fn(), create: vi.fn(), fetch: vi.fn(), sourceBinding: vi.fn(), quota: vi.fn(),
  source: { hostname: 'books.example.org', titleSelector: 'h1', contentSelector: '.chapter', chapterLinkSelector: '.toc a', storySelectors: { title: '.story-title', description: '.intro' } },
}))
vi.mock('../../../config/env.js', () => ({ env: { CRAWLER_SOURCES_JSON: JSON.stringify([mocks.source]) } }))
vi.mock('../../../common/logger.js', () => ({ logger: { info: vi.fn() } }))
vi.mock('../../../repositories/story.repository.js', () => ({ storyRepository: { findById: mocks.findStory } }))
vi.mock('../../../repositories/crawler-story-source.repository.js', () => ({ crawlerStorySourceRepository: { find: mocks.sourceBinding } }))
vi.mock('../../../repositories/chapter.repository.js', () => ({ chapterRepository: {
  findByStoryAndSlug: mocks.bySlug, findByStoryAndOrder: mocks.byOrder, create: mocks.create,
} }))
vi.mock('../crawler.transport.js', () => ({ fetchCrawlerHtml: mocks.fetch }))
vi.mock('../crawler.cache.js', () => ({ crawlerCache: {
  quota: mocks.quota, get: vi.fn(async (key: string) => mocks.cache.get(key) ?? null),
  put: vi.fn(async (key: string, value: unknown) => { mocks.cache.set(key, value) }),
} }))
import { crawlerService } from '../crawler.service.js'
import { crawlImportSchema } from '../crawler.validation.js'

const sourceUrl = 'https://books.example.org/chapter-1'
const chapter = { _id: 'chapter-id', title: 'Tên chương', order: 3 }
beforeEach(() => {
  vi.clearAllMocks(); mocks.cache.clear()
  mocks.findStory.mockResolvedValue({ moderationStatus: 'approved' })
  mocks.bySlug.mockReset().mockResolvedValue(null)
  mocks.byOrder.mockResolvedValue(null)
  mocks.sourceBinding.mockReset().mockResolvedValue(null)
  mocks.create.mockReset().mockResolvedValue(chapter)
  mocks.fetch.mockResolvedValue('<h1>Tên chương</h1><div class="chapter"><p>Nội dung tự viết để kiểm thử.</p></div>')
})
async function preview() { return crawlerService.preview('user', 'story', sourceUrl) }
describe('real crawler persistence workflow (repositories mocked)', () => {
  it('rejects metadata for an already bound source before quota, network or story creation', async () => {
    mocks.sourceBinding.mockResolvedValue({ storyId: 'existing-story' })
    await expect(crawlerService.metadata('user', sourceUrl)).rejects.toMatchObject({ statusCode: 409, code: 'CRAWLER_STORY_EXISTS' })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.quota).not.toHaveBeenCalled()
    expect(mocks.findStory).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('rejects an already imported chapter URL before quota, fetching or saving another preview', async () => {
    mocks.bySlug.mockResolvedValue(chapter)
    await expect(preview()).rejects.toMatchObject({ statusCode: 409, code: 'CRAWLER_CHAPTER_EXISTS' })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.quota).not.toHaveBeenCalled()
    expect(mocks.cache.size).toBe(0)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('previews metadata without looking up or creating any story/chapter', async () => {
    mocks.fetch.mockResolvedValue('<h1 class="story-title">Truyện mới</h1><p class="intro">Giới thiệu truyện mới.</p>')
    const result = await crawlerService.metadata('user', sourceUrl)
    expect(result.story).toMatchObject({ title: 'Truyện mới', description: 'Giới thiệu truyện mới.' })
    expect(result.sourceUrl).toBe(sourceUrl)
    expect(mocks.findStory).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('reports a missing metadata profile match without creating placeholder records', async () => {
    await expect(crawlerService.metadata('user', sourceUrl)).rejects.toMatchObject({ code: 'CRAWLER_EMPTY_STORY' })
    expect(mocks.findStory).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('saves exactly the reviewed snapshot as a pending draft without refetching', async () => {
    const value = await preview()
    const result = await crawlerService.importChapter('user', 'story', { previewToken: value.previewToken, title: 'Đã sửa tên', order: 3, rightsConfirmed: true })
    expect(result.alreadyImported).toBe(false)
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Đã sửa tên', order: 3, status: 'draft', moderationStatus: 'pending', slug: expect.stringMatching(/^crawl-[a-f0-9]{64}$/), contentHtml: expect.stringContaining('<p>Nội dung tự viết để kiểm thử.</p>') }))
  })
  it('returns an existing source without writing or overwriting', async () => {
    const value = await preview(); mocks.bySlug.mockResolvedValue(chapter)
    expect((await crawlerService.importChapter('user', 'story', { ...value, order: 3, rightsConfirmed: true })).alreadyImported).toBe(true)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('handles Mongo unique source races idempotently', async () => {
    const value = await preview()
    mocks.bySlug.mockResolvedValueOnce(null).mockResolvedValueOnce(chapter)
    mocks.create.mockRejectedValue({ code: 11000 })
    expect((await crawlerService.importChapter('user', 'story', { ...value, order: 3, rightsConfirmed: true })).alreadyImported).toBe(true)
  })
  it('rejects an occupied order without overwriting', async () => {
    const value = await preview(); mocks.byOrder.mockResolvedValue(chapter)
    await expect(crawlerService.importChapter('user', 'story', { ...value, order: 3, rightsConfirmed: true })).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('binds the preview to both story and user and rejects expiration', async () => {
    const value = await preview()
    for (const [userId, storyId] of [['other', 'story'], ['user', 'other']]) {
      await expect(crawlerService.importChapter(userId, storyId, { ...value, order: 3, rightsConfirmed: true })).rejects.toMatchObject({ code: 'CRAWLER_PREVIEW_EXPIRED' })
    }
    mocks.cache.clear()
    await expect(crawlerService.importChapter('user', 'story', { ...value, order: 3, rightsConfirmed: true })).rejects.toMatchObject({ code: 'CRAWLER_PREVIEW_EXPIRED' })
  })
  it('requires rights confirmation and rejects removed stories', async () => {
    expect(crawlImportSchema.safeParse({ previewToken: 'a', title: 'T', order: 1, rightsConfirmed: false }).success).toBe(false)
    mocks.findStory.mockResolvedValue({ moderationStatus: 'removed' })
    await expect(preview()).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('paginates a cached catalog with a cursor bound to owner and URL', async () => {
    mocks.fetch.mockResolvedValue(`<div class="toc">${Array.from({ length: 51 }, (_, i) => `<a href="/${i}">Chương ${i}</a>`).join('')}</div>`)
    const first = await crawlerService.catalog('user', 'story', sourceUrl)
    expect(first.chapters).toHaveLength(50)
    const second = await crawlerService.catalog('user', 'story', sourceUrl, first.nextCursor!)
    expect(second.chapters).toHaveLength(1)
    expect(second.nextCursor).toBeNull()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    await expect(crawlerService.catalog('other', 'story', sourceUrl, first.nextCursor!)).rejects.toThrow()
  })
})
