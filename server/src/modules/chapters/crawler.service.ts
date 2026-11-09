import { createHash, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { AppError } from '../../common/AppError.js'
import { logger } from '../../common/logger.js'
import { chapterRepository } from '../../repositories/chapter.repository.js'
import { storyRepository } from '../../repositories/story.repository.js'
import { crawlerStorySourceRepository } from '../../repositories/crawler-story-source.repository.js'
import { crawlerCache } from './crawler.cache.js'
import { resolveSource } from './crawler.config.js'
import { parseCatalog, parseChapter, parseStoryMetadata, textToChapterHtml } from './crawler.parser.js'
import { fetchCrawlerHtml } from './crawler.transport.js'
import type { CrawlImportInput } from './crawler.validation.js'

type Catalog = ReturnType<typeof parseCatalog>
interface Snapshot extends ReturnType<typeof parseChapter> {
  userId: string; storyId: string; sourceUrl: string; expiresAt: string
}

async function assertStory(storyId: string) {
  const story = await storyRepository.findById(storyId)
  if (!story || story.moderationStatus === 'removed') throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ')
}

async function loadCover(story: ReturnType<typeof parseStoryMetadata>, url: URL) {
  if (!story?.coverUrl) return
  try {
    if (new URL(story.coverUrl).hostname === url.hostname) await delay(2100)
    story.coverBase64 = await fetchCrawlerHtml(new URL(story.coverUrl), true)
  } catch {
    story.coverWarning = 'Không tải được ảnh bìa an toàn (robots, định dạng, kích thước hoặc kết nối). Bạn có thể tải ảnh lên trong form truyện.'
  }
}

/** Fetch approved sources, retain previews in Redis, and persist confirmed drafts only. */
export const crawlerService = {
  async metadata(userId: string, rawUrl: string) {
    const { source, url } = resolveSource(rawUrl)
    if (await crawlerStorySourceRepository.find(url.href)) {
      throw AppError.conflict('Truyện từ URL nguồn này đã có trên hệ thống. Hãy dùng chức năng nhập chương còn thiếu.', 'CRAWLER_STORY_EXISTS')
    }
    await crawlerCache.quota(userId)
    const story = parseStoryMetadata(await fetchCrawlerHtml(url), url, source)
    if (!story) throw AppError.badRequest('Không tìm thấy thông tin truyện. Hãy nhập URL trang giới thiệu truyện và kiểm tra cấu hình nguồn.', 'CRAWLER_EMPTY_STORY')
    await loadCover(story, url)
    return { story, sourceUrl: url.href }
  },
  async catalog(userId: string, storyId: string, rawUrl: string, cursor?: string) {
    await assertStory(storyId)
    await crawlerCache.quota(userId)
    const { source, url } = resolveSource(rawUrl)
    let token = randomUUID() as string
    let offset = 0
    let catalog: Catalog
    if (cursor) {
      const match = /^([a-f\d-]{36}):(\d{1,4})$/.exec(cursor)
      if (!match) throw AppError.badRequest('Cursor không hợp lệ')
      token = match[1]; offset = Number(match[2])
      const cached = await crawlerCache.get<Catalog>(`catalog:${userId}:${storyId}:${token}`)
      if (!cached || cached.sourceUrl !== url.href || offset >= cached.chapters.length || offset % 50 !== 0) {
        throw AppError.badRequest('Mục lục hết hạn hoặc cursor không hợp lệ. Hãy tải lại mục lục.')
      }
      catalog = cached
    } else {
      catalog = parseCatalog(await fetchCrawlerHtml(url), url, source, false)
      await crawlerCache.put(`catalog:${userId}:${storyId}:${token}`, catalog)
    }
    const hasNextPage = offset + 50 < catalog.chapters.length
    return { title: catalog.title, sourceUrl: catalog.sourceUrl, truncated: catalog.truncated,
      chapters: catalog.chapters.slice(offset, offset + 50),
      nextCursor: hasNextPage ? `${token}:${offset + 50}` : null, hasNextPage }
  },

  async preview(userId: string, storyId: string, rawUrl: string) {
    await assertStory(storyId)
    const { source, url } = resolveSource(rawUrl)
    const slug = `crawl-${createHash('sha256').update(url.href).digest('hex')}`
    if (await chapterRepository.findByStoryAndSlug(storyId, slug)) {
      throw AppError.conflict('Chương từ URL này đã có trong truyện. Nội dung hiện có được giữ nguyên.', 'CRAWLER_CHAPTER_EXISTS')
    }
    await crawlerCache.quota(userId)
    const content = parseChapter(await fetchCrawlerHtml(url), source)
    const previewToken = randomUUID()
    const snapshot: Snapshot = { ...content, userId, storyId, sourceUrl: url.href,
      expiresAt: new Date(Date.now() + 1800_000).toISOString() }
    await crawlerCache.put(`preview:${previewToken}`, snapshot)
    return { ...content, sourceUrl: url.href, previewToken, expiresAt: snapshot.expiresAt }
  },

  async importChapter(userId: string, storyId: string, input: CrawlImportInput) {
    await assertStory(storyId)
    await crawlerCache.quota(userId)
    if (input.rightsConfirmed !== true) throw AppError.badRequest('Cần xác nhận quyền sử dụng nội dung')
    const snapshot = await crawlerCache.get<Snapshot>(`preview:${input.previewToken}`)
    if (!snapshot || snapshot.userId !== userId || snapshot.storyId !== storyId || Date.parse(snapshot.expiresAt) <= Date.now()) {
      throw AppError.badRequest('Bản xem trước hết hạn hoặc không thuộc truyện/tài khoản này. Hãy xem trước lại.', 'CRAWLER_PREVIEW_EXPIRED')
    }
    resolveSource(snapshot.sourceUrl)
    const slug = `crawl-${createHash('sha256').update(snapshot.sourceUrl).digest('hex')}`
    const result = (chapter: { _id: unknown; title: string; order: number }, alreadyImported: boolean) =>
      ({ chapterId: String(chapter._id), title: chapter.title, order: chapter.order, alreadyImported })
    const existing = await chapterRepository.findByStoryAndSlug(storyId, slug)
    if (existing) return result(existing, true)
    if (await chapterRepository.findByStoryAndOrder(storyId, input.order)) {
      throw AppError.conflict('Số thứ tự chương đã tồn tại. Hãy chọn số khác.', 'CHAPTER_ORDER_CONFLICT')
    }
    try {
      const chapter = await chapterRepository.create({ storyId, slug, title: input.title, order: input.order,
        contentHtml: textToChapterHtml(snapshot.text), wordCount: snapshot.wordCount,
        status: 'draft', moderationStatus: 'pending' })
      logger.info('crawler.import.confirmed', { userId, storyId, chapterId: String(chapter._id),
        sourceHost: new URL(snapshot.sourceUrl).hostname, sourceHash: slug, rightsConfirmed: true })
      return result(chapter, false)
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        const duplicate = await chapterRepository.findByStoryAndSlug(storyId, slug)
        if (duplicate) return result(duplicate, true)
        throw AppError.conflict('Số thứ tự vừa được sử dụng. Hãy chọn số khác.', 'CHAPTER_ORDER_CONFLICT')
      }
      throw error
    }
  },
}
