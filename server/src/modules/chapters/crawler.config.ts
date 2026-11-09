import { isIP } from 'node:net'
import { z } from 'zod'
import { load } from 'cheerio'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'

const selector = z.string().trim().min(1).max(256)
const sourcesSchema = z.array(z.object({
  hostname: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/)
    .refine(host => !isIP(host)),
  titleSelector: selector,
  contentSelector: selector,
  chapterLinkSelector: selector,
  nextCatalogSelector: selector.optional(),
  removeSelector: selector.optional(),
  storySelectors: z.object({
    title: selector, description: selector, author: selector.optional(),
    genres: selector.optional(), status: selector.optional(), cover: selector.optional(),
  }).optional(),
  imageHosts: z.array(z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/)).max(5).optional(),
})).max(20)
export type CrawlerSource = z.infer<typeof sourcesSchema>[number]

export function getCrawlerSources(): CrawlerSource[] {
  try {
    const sources = sourcesSchema.parse(JSON.parse(env.CRAWLER_SOURCES_JSON))
    const $ = load('')
    for (const source of sources) {
      $(source.titleSelector); $(source.contentSelector); $(source.chapterLinkSelector)
      if (source.nextCatalogSelector) $(source.nextCatalogSelector)
      if (source.removeSelector) $(source.removeSelector)
      for (const value of Object.values(source.storySelectors ?? {})) $(value)
    }
    return sources
  } catch {
    throw new AppError(503, 'Cấu hình nguồn crawler không hợp lệ. Liên hệ quản trị viên.', 'CRAWLER_CONFIG')
  }
}

export function normalizeSourceUrl(raw: string, hostname: string): URL {
  let url: URL
  try { url = new URL(raw) } catch { throw AppError.badRequest('URL nguồn không hợp lệ', 'CRAWLER_URL') }
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      isIP(url.hostname) || url.hostname !== hostname) {
    throw AppError.badRequest('Chỉ nhận HTTPS cổng 443 trên đúng nguồn được cấu hình', 'CRAWLER_URL')
  }
  url.hash = ''
  return url
}

export function resolveSource(raw: string) {
  let host: string
  try { host = new URL(raw).hostname } catch { throw AppError.badRequest('URL không hợp lệ') }
  const source = getCrawlerSources().find(item => item.hostname === host)
  if (!source) throw AppError.badRequest('Nguồn này chưa được bật. Quản trị viên cần cấu hình CRAWLER_SOURCES_JSON.', 'CRAWLER_SOURCE_DISABLED')
  return { source, url: normalizeSourceUrl(raw, source.hostname) }
}
