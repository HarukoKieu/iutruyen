/**
 * SEO Controller — Phase 8
 *
 * Xử lý HTTP request/response cho SEO endpoints.
 * Tất cả endpoints là GET/HEAD, public, không có auth side-effects.
 * Error mapping: 404 → resource not public; 400 → bad params; 503 → dependency fail.
 */
import { Request, Response, NextFunction } from 'express'
import { ApiResponse } from '../../common/ApiResponse.js'
import { AppError } from '../../common/AppError.js'
import { logger } from '../../common/logger.js'
import { seoService } from './seo.service.js'
import {
  storySlugParamSchema,
  chapterSlugParamSchema,
  tocQuerySchema,
  coverParamSchema,
  sitemapShardParamSchema,
  catalogKindParamSchema,
} from './seo.validation.js'
import { sitemapJob } from '../../jobs/sitemap-manifest.job.js'
import { xmlBuilder } from '../../common/xmlBuilder.js'
import { decodeCover } from './seo.cover.js'
import { env } from '../../config/env.js'

// ─── Stories ───────────────────────────────────────────────────────────────

export const getStoryMeta = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = storySlugParamSchema.parse(req.params)
    const result = await seoService.getStoryPage(slug)
    res.setHeader('Cache-Control', 'no-store')
    ApiResponse.success(res, result)
  } catch (err) {
    next(err)
  }
}

export const getStoryToc = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = storySlugParamSchema.parse(req.params)
    const { cursor, limit } = tocQuerySchema.parse(req.query)

    const toc = await seoService.getStoryToc(slug, cursor, limit)

    res.setHeader('Cache-Control', 'no-store')
    ApiResponse.success(res, toc)
  } catch (err) {
    next(err)
  }
}

// ─── Chapter ───────────────────────────────────────────────────────────────

export const getChapterMeta = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug, chapterSlug } = chapterSlugParamSchema.parse(req.params)
    const result = await seoService.getChapterPage(slug, chapterSlug)
    res.setHeader('Cache-Control', 'no-store')
    ApiResponse.success(res, result)
  } catch (err) {
    next(err)
  }
}

// ─── Catalog ───────────────────────────────────────────────────────────────

export const getCatalog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { kind } = catalogKindParamSchema.parse(req.params)
    const result = await seoService.getCatalogPage(kind)
    res.setHeader('Cache-Control', 'no-store')
    ApiResponse.success(res, result)
  } catch (err) {
    next(err)
  }
}

// ─── Cover ─────────────────────────────────────────────────────────────────

export const getStoryCover = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { storyId } = coverParamSchema.parse(req.params)
    const { coverUrl } = await seoService.getCoverData(storyId)

    const cover = decodeCover(coverUrl)
    if (!cover) throw AppError.notFound('Ảnh không khả dụng', 'COVER_NOT_FOUND')
    res.setHeader('Content-Type', cover.mime)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).end(cover.bytes)
  } catch (err) {
    next(err)
  }
}

// ─── Sitemap ───────────────────────────────────────────────────────────────

export const getSitemapIndex = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const manifest = await sitemapJob.getSummary()

    if (!manifest) {
      res
        .status(503)
        .setHeader('Retry-After', '60')
        .setHeader('Content-Type', 'text/plain; charset=utf-8')
        .send('Sitemap đang được khởi tạo, vui lòng thử lại sau 60 giây.')
      return
    }

    const siteUrl = env.PUBLIC_SITE_URL
    const storyShardCount = manifest.storyShardCount
    const chapterShardCount = manifest.chapterShardCount
    const gen = manifest.generation

    const urlEntries: string[] = []
    for (let i = 0; i < storyShardCount; i++) {
      urlEntries.push(
        `  <sitemap><loc>${xmlBuilder.escapeXml(siteUrl)}/sitemaps/${gen}/stories/${i}.xml</loc></sitemap>`
      )
    }
    for (let i = 0; i < chapterShardCount; i++) {
      urlEntries.push(
        `  <sitemap><loc>${xmlBuilder.escapeXml(siteUrl)}/sitemaps/${gen}/chapters/${i}.xml</loc></sitemap>`
      )
    }

    const xml = xmlBuilder.buildSitemapIndex(urlEntries)

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    const byteLength = Buffer.byteLength(xml, 'utf8')
    const MAX_SITEMAP_BYTES = 10 * 1024 * 1024 // 10 MiB
    if (byteLength > MAX_SITEMAP_BYTES) {
      logger.error('[SEO] Sitemap index exceeds 10 MiB', { byteLength })
      res.status(503).send('Sitemap quá lớn, đang rebuild.')
      return
    }

    res.status(200).send(xml)
  } catch (err) {
    next(err)
  }
}

export const getSitemapShard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { generation, kind, shard } = sitemapShardParamSchema.parse(req.params)
    const manifest = await sitemapJob.getSummary(generation)

    if (!manifest || manifest.generation !== generation) {
      res
        .status(503)
        .setHeader('Retry-After', '60')
        .setHeader('Content-Type', 'text/plain; charset=utf-8')
        .send('Shard không khả dụng, vui lòng thử lại.')
      return
    }

    const shardCount = kind === 'stories' ? manifest.storyShardCount : manifest.chapterShardCount

    if (shard >= shardCount) {
      throw AppError.notFound('Shard không tồn tại', 'SHARD_NOT_FOUND')
    }

    const ids = await sitemapJob.getShard(generation, kind, shard)
    if (!ids) throw new Error('Sitemap generation expired during request')
    const hydrateResult = await seoService.hydrateSitemapShard(ids, kind)
    const siteUrl = env.PUBLIC_SITE_URL

    let urlEntries: string[]
    if (kind === 'stories') {
      urlEntries = (hydrateResult.storyEntries ?? []).map(
        (e) => `  <url><loc>${xmlBuilder.escapeXml(siteUrl)}/stories/${xmlBuilder.escapeXml(encodeURIComponent(e.slug))}</loc></url>`
      )
    } else {
      urlEntries = (hydrateResult.chapterEntries ?? []).map(
        (e) =>
          `  <url><loc>${xmlBuilder.escapeXml(siteUrl)}/stories/${xmlBuilder.escapeXml(encodeURIComponent(e.storySlug))}/chapters/${xmlBuilder.escapeXml(encodeURIComponent(e.slug))}</loc></url>`
      )
    }

    const xml = xmlBuilder.buildUrlSet(urlEntries)

    const byteLength = Buffer.byteLength(xml, 'utf8')
    const MAX_SHARD_BYTES = 10 * 1024 * 1024
    if (byteLength > MAX_SHARD_BYTES) {
      logger.error('[SEO] Sitemap shard exceeds 10 MiB', { generation, kind, shard, byteLength })
      res.status(503).send('Shard quá lớn, đang rebuild.')
      return
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.status(200).send(xml)
  } catch (err) {
    next(err)
  }
}

// ─── Robots ────────────────────────────────────────────────────────────────

export const getRobots = (
  _req: Request,
  res: Response
): void => {
  const siteUrl = env.PUBLIC_SITE_URL
  const isIndexable = env.SEO_INDEXABLE

  let robotsTxt: string
  if (isIndexable) {
    robotsTxt = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /mod/',
      'Disallow: /author/',
      'Disallow: /profile/',
      'Disallow: /login',
      'Disallow: /register',
      'Disallow: /reset-password',
      'Disallow: /forgot-password',
      'Disallow: /oauth-callback',
      '',
      `Sitemap: ${xmlBuilder.escapeXml(siteUrl)}/sitemap.xml`,
    ].join('\n')
  } else {
    // staging / development: noindex toàn bộ
    robotsTxt = ['User-agent: *', 'Disallow: /'].join('\n')
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).send(robotsTxt)
}
