import { load } from 'cheerio'
import { AppError } from '../../common/AppError.js'
import { normalizeSourceUrl, type CrawlerSource } from './crawler.config.js'

export function parseStoryMetadata(html: string, url: URL, source: CrawlerSource) {
  const selectors = source.storySelectors
  if (!selectors) return undefined
  const $ = load(html)
  $('script,style,noscript,iframe,template,form,nav,[hidden]').remove()
  if (source.removeSelector) $(source.removeSelector).remove()
  const text = (selector?: string) => selector ? $(selector).first().text().replace(/\s+/g, ' ').trim() : ''
  const title = text(selectors.title)
  if (!title) return undefined
  const descriptionNode = $(selectors.description).clone()
  descriptionNode.find('br').replaceWith('\n')
  descriptionNode.find('p,div,li').append('\n\n')
  descriptionNode.append('\n\n')
  const description = descriptionNode.text().replace(/[\t \u00a0]+/g, ' ')
    .split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const author = text(selectors.author).replace(/^Tác giả\s*:\s*/i, '')
  const rawStatus = text(selectors.status).replace(/^Trạng thái\s*:\s*/i, '')
  const status: 'ongoing' | 'completed' | 'hiatus' | undefined =
    /^(hoàn thành|hoàn tất|full|completed)$/i.test(rawStatus) ? 'completed'
      : /^(đang ra|đang cập nhật|đang tiến hành|ongoing)$/i.test(rawStatus) ? 'ongoing'
        : /^(tạm ngưng|tạm dừng|hiatus)$/i.test(rawStatus) ? 'hiatus' : undefined
  const genres = selectors.genres ? [...new Set($(selectors.genres).map((_, element) =>
    $(element).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean))].slice(0, 30) : []
  let coverUrl: string | undefined
  const cover = selectors.cover ? $(selectors.cover).first() : undefined
  const rawCover = cover?.attr('data-src') || cover?.attr('src') || cover?.attr('content')
  if (rawCover) {
    try {
      const target = new URL(rawCover, url)
      if ([source.hostname, ...(source.imageHosts ?? [])].includes(target.hostname)) {
        coverUrl = normalizeSourceUrl(target.href, target.hostname).href
      }
    } catch { /* Ignore unsafe cover locations. */ }
  }
  return { title: title.slice(0, 150), description: description.slice(0, 5000),
    author: author.slice(0, 200), genres, status, rawStatus: rawStatus.slice(0, 100), coverUrl,
    coverBase64: undefined as string | undefined, coverWarning: undefined as string | undefined,
    truncated: title.length > 150 || description.length > 5000 }
}

export function parseCatalog(html: string, url: URL, source: CrawlerSource, includeMetadata = true) {
  const $ = load(html)
  $('script,style,noscript,iframe,template').remove()
  const links = new Map<string, { title: string; url: string }>()
  $(source.chapterLinkSelector).each((_, element) => {
    const href = $(element).attr('href')
    if (!href) return
    try {
      const target = normalizeSourceUrl(new URL(href, url).href, source.hostname).href
      const title = $(element).text().replace(/\s+/g, ' ').trim().slice(0, 200)
      if (title && !links.has(target) && links.size < 2001) links.set(target, { title, url: target })
    } catch { /* Ignore off-site and non-HTTPS navigation. */ }
  })
  const story = includeMetadata ? parseStoryMetadata(html, url, source) : undefined
  if (!links.size && !story) throw AppError.badRequest('Không tìm thấy liên kết chương. Kiểm tra URL và selector nguồn.', 'CRAWLER_EMPTY_CATALOG')
  return {
    story,
    title: $('title').first().text().trim().slice(0, 200), sourceUrl: url.href,
    chapters: [...links.values()].slice(0, 2000), truncated: links.size > 2000,
  }
}

export function parseChapter(html: string, source: CrawlerSource) {
  const $ = load(html)
  $('script,style,noscript,iframe,template,form,nav,[hidden]').remove()
  if (source.removeSelector) $(source.removeSelector).remove()
  const title = $(source.titleSelector).first().text().replace(/\s+/g, ' ').trim().slice(0, 200)
  const content = $(source.contentSelector).first()
  content.find('br').replaceWith('\n')
  content.find('p,div,section,li,h1,h2,h3,blockquote').each((_, el) => { $(el).append('\n\n') })
  const text = content.text().replace(/\r/g, '').replace(/[\t \u00a0]+/g, ' ')
    .split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!title && !text && $(source.chapterLinkSelector).length > 0) {
    throw AppError.badRequest('Trang này có danh sách chương nhưng không có nội dung chương. Hãy bấm “Lấy mục lục”, rồi chọn một chương trong danh sách để xem trước.', 'CRAWLER_CATALOG_URL')
  }
  if (!title || !text) throw AppError.badRequest('Không trích được tiêu đề/nội dung. Nguồn có thể cần JavaScript hoặc selector đã thay đổi.', 'CRAWLER_EMPTY_CHAPTER')
  if (text.length > 100_000) throw AppError.badRequest('Chương vượt giới hạn 100.000 ký tự', 'CRAWLER_CONTENT_LIMIT')
  return { title, text, wordCount: text.split(/\s+/).length }
}

export function textToChapterHtml(text: string) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  return text.split(/\n\n+/).map(p => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`).join('')
}
