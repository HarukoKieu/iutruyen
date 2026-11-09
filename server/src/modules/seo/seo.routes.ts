/**
 * SEO Routes — Phase 8
 *
 * Tất cả endpoints là GET/HEAD, không có mutation, không auth bắt buộc.
 * Rate limit: 120 req/phút cho mỗi IP (bảo vệ crawler spam, không whitelist bot).
 * robots.txt và sitemap.xml serve tại root path (được mount trực tiếp trong app.ts).
 */
import { AppError } from '../../common/AppError.js'
import { ZodError } from 'zod'
import { logger } from '../../common/logger.js'
import { Router } from 'express'
import { rateLimit } from '../../middlewares/rateLimit.js'
import { seoRateIdentity } from '../../common/seoRateIdentity.js'
import {
  getStoryMeta,
  getStoryToc,
  getChapterMeta,
  getCatalog,
  getStoryCover,
  getSitemapIndex,
  getSitemapShard,
  getRobots,
} from './seo.controller.js'

const router = Router()
const noStore: import('express').RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex')
  next()
}
router.use(noStore)

/** Rate limit nhẹ cho SEO endpoints — bảo vệ crawl spam. */
const seoRateLimit = rateLimit({
  windowSeconds: 60,
  maxRequests: 120,
  prefix: 'seo-render',
  keyGenerator: seoRateIdentity,
})
// Asset/crawler requests must not consume the page-render quota.
const coverRateLimit = rateLimit({ windowSeconds: 60, maxRequests: 120, prefix: 'seo-cover', keyGenerator: seoRateIdentity })
const sitemapRateLimit = rateLimit({ windowSeconds: 60, maxRequests: 120, prefix: 'seo-sitemap', keyGenerator: seoRateIdentity })

// robots.txt — phục vụ tại /robots.txt (được mount ở root)
router.get('/robots.txt', getRobots)

// Sitemap index — /sitemap.xml
router.get('/sitemap.xml', sitemapRateLimit, getSitemapIndex)

// Sitemap shards — /sitemaps/:generation/:kind/:shard.xml
router.get('/sitemaps/:generation/:kind/:shard.xml', sitemapRateLimit, getSitemapShard)

// Story metadata — /api/v1/seo/stories/:slug
router.get('/stories/:slug', seoRateLimit, getStoryMeta)

// Story TOC — /api/v1/seo/stories/:slug/toc
router.get('/stories/:slug/toc', seoRateLimit, getStoryToc)

// Chapter metadata — /api/v1/seo/stories/:slug/chapters/:chapterSlug
router.get('/stories/:slug/chapters/:chapterSlug', seoRateLimit, getChapterMeta)

// Catalog — /api/v1/seo/catalog/:kind (home|stories|ranking)
router.get('/catalog/:kind', seoRateLimit, getCatalog)

// Cover image — /api/v1/seo/covers/:storyId
router.get('/covers/:storyId', coverRateLimit, getStoryCover)

export default router

/** Router riêng cho root-level sitemap/robots (mount ở '/' trong app.ts) */
export const sitemapRootRouter = Router()
sitemapRootRouter.use(['/robots.txt', '/sitemap.xml', '/sitemaps'], noStore)
sitemapRootRouter.get('/robots.txt', getRobots)
sitemapRootRouter.get('/sitemap.xml', sitemapRateLimit, getSitemapIndex)
sitemapRootRouter.get('/sitemaps/:generation/:kind/:shard.xml', sitemapRateLimit, getSitemapShard)

const seoError: import('express').ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof AppError || error instanceof ZodError) { next(error); return }
  logger.error('SEO dependency failure', { name: error instanceof Error ? error.name : 'Unknown' })
  res.setHeader('Retry-After', '60')
  next(new AppError(503, 'Nội dung tạm thời không khả dụng', 'SEO_UNAVAILABLE'))
}
router.use(seoError)
sitemapRootRouter.use(seoError)
