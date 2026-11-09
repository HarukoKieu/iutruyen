import { load } from 'cheerio'
import { AppError } from '../../common/AppError.js'
import { normalizeSourceUrl, type CrawlerSource } from './crawler.config.js'
import { parseCatalog, parseStoryMetadata } from './crawler.parser.js'

/** Explicit source pagination only. Unsafe/malformed next links fail rather than silently truncate. */
export function parseCrawlerJobPage(html: string, url: URL, source: CrawlerSource) {
  const catalog = parseCatalog(html, url, source, false)
  let nextUrl: string | undefined
  if (source.nextCatalogSelector) {
    const $ = load(html)
    const href = $(source.nextCatalogSelector).first().attr('href')
    if (href) {
      try { nextUrl = normalizeSourceUrl(new URL(href, url).href, source.hostname).href }
      catch { throw AppError.badRequest('Liên kết mục lục tiếp theo không hợp lệ', 'CRAWLER_PAGINATION_URL') }
    }
  }
  return { chapters: catalog.chapters, truncated: catalog.truncated, nextUrl, metadata: parseStoryMetadata(html, url, source),
    warning: source.nextCatalogSelector ? undefined : 'Nguồn chưa cấu hình phân trang: chỉ lấy chương trên trang mục lục đã nhập.' }
}
