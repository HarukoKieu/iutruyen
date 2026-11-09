/**
* SEO Service — Phase 8
*
* Orchestration layer: lấy dữ liệu public từ seoRepository, build metadata và
* kiểm tra policy (mature, visibility). KHÔNG ghi view/history/analytics.
*
* Tất cả metadata đi qua một builder chung để nhất quán.
*/
import { seoAuthor } from './seo.attribution.js'
import { env } from '../../config/env.js'
import { logger } from '../../common/logger.js'
import { AppError } from '../../common/AppError.js'
import { storyRepository } from '../../repositories/story.repository.js'
import {
  mapStoryToDto,
  seoRepository,
  type StoryRenderDto,
  type ChapterRenderDto,
  type TocItemDto,
  type SitemapStoryEntry,
  type SitemapChapterEntry,
} from '../../repositories/seo.repository.js'


// ─── Meta Builder ─────────────────────────────────────────────────────────

export interface PageMeta {
  title: string
  description: string
  canonical: string
  /** true = có thể index; false = noindex */
  indexable: boolean
  contentWarning: 'none' | 'mature18+'
  og: {
    title: string
    description: string
    url: string
    image: string
    type: 'website' | 'book' | 'article'
  }
  twitter: {
    card: 'summary_large_image'
    title: string
    description: string
    image: string
  }
  jsonLd: object | null
}

const SITE_NAME = 'iutruyen'
const DEFAULT_DESCRIPTION =
  'iutruyen — Đọc truyện chữ online miễn phí, cập nhật nhanh nhất'
const DEFAULT_OG_IMAGE = `${env.PUBLIC_SITE_URL}/og-default.png`

/** Rút plain text và cắt đúng Unicode. */
function stripHtmlAndTruncate(html: string, maxLen: number): string {
  // Xóa tags HTML
  const plain = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= maxLen) return plain
  // Cắt tại ranh giới Unicode (không cắt giữa codepoint)
  const arr = [...plain]
  return arr.slice(0, maxLen - 1).join('') + '…'
}

function buildCanonical(path: string): string {
  const base = env.PUBLIC_SITE_URL
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

// ─── Story SEO ─────────────────────────────────────────────────────────────

export interface StoryPageResult {
  story: StoryRenderDto
  toc: {
    items: TocItemDto[]
    nextCursor: string | null
    hasMore: boolean
  }
  meta: PageMeta
}

export const getStoryPage = async (slug: string): Promise<StoryPageResult> => {
  const story = await seoRepository.findPublicStoryBySlug(slug)
  if (!story) throw AppError.notFound('Truyện không tồn tại hoặc chưa được duyệt', 'STORY_NOT_FOUND')

  const toc = await seoRepository.findPublicToc(story._id, undefined, 50)

  const isMature = story.contentWarning === 'mature18+'
  const description = stripHtmlAndTruncate(story.description, 160)
  const title = `${story.title} — ${SITE_NAME}`
  const canonical = buildCanonical(`/stories/${story.slug}`)
  const ogImage = DEFAULT_OG_IMAGE // cover phục vụ qua /seo/covers/:id

  // JSON-LD Book schema (không bịa ISBN, publisher, datePublished)
  const jsonLd = isMature
    ? null
    : {
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: story.title,
      description: story.description.slice(0, 500),
      url: canonical,
      inLanguage: 'vi',
      ...(seoAuthor(story)
        ? {
          author: {
            '@type': 'Person',
            name:
              seoAuthor(story),
          },
        }
        : {}),
      genre: story.genres.map((g) => g.name),
    }

  const meta: PageMeta = {
    title,
    description,
    canonical,
    indexable: env.SEO_INDEXABLE && !isMature,
    contentWarning: story.contentWarning as 'none' | 'mature18+',
    og: {
      title,
      description,
      url: canonical,
      image: ogImage,
      type: 'book',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      image: ogImage,
    },
    jsonLd,
  }

  return { story, toc, meta }
}

// ─── Chapter SEO ───────────────────────────────────────────────────────────

export interface ChapterPageResult {
  story: StoryRenderDto
  chapter: ChapterRenderDto
  prev: { slug: string; title: string; order: number } | null
  next: { slug: string; title: string; order: number } | null
  meta: PageMeta
}

export const getChapterPage = async (
  storySlug: string,
  chapterSlug: string
): Promise<ChapterPageResult> => {
  const result = await seoRepository.findPublicChapter(storySlug, chapterSlug)
  if (!result) {
    throw AppError.notFound(
      'Chương không tồn tại hoặc truyện chưa được duyệt',
      'CHAPTER_NOT_FOUND'
    )
  }

  const { story, chapter, prev, next } = result
  const isMature = story.contentWarning === 'mature18+'

  const chapterTitle = `${chapter.title} — ${story.title} — ${SITE_NAME}`
  const description = isMature
    ? `Đọc ${story.title} tại ${SITE_NAME}. Nội dung dành cho độc giả 18+.`
    : stripHtmlAndTruncate(chapter.contentHtml, 160)
  const canonical = buildCanonical(
    `/stories/${story.slug}/chapters/${chapter.slug}`
  )

  const jsonLd = isMature
    ? null
    : {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: chapter.title,
      description: description.slice(0, 500),
      url: canonical,
      inLanguage: 'vi',
      isPartOf: {
        '@type': 'Book',
        name: story.title,
        url: buildCanonical(`/stories/${story.slug}`),
      },
      ...(seoAuthor(story)
        ? {
          author: {
            '@type': 'Person',
            name:
              seoAuthor(story),
          },
        }
        : {}),
    }

  const meta: PageMeta = {
    title: chapterTitle,
    description,
    canonical,
    indexable: env.SEO_INDEXABLE && !isMature,
    contentWarning: story.contentWarning as 'none' | 'mature18+',
    og: {
      title: chapterTitle,
      description,
      url: canonical,
      image: DEFAULT_OG_IMAGE,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: chapterTitle,
      description,
      image: DEFAULT_OG_IMAGE,
    },
    jsonLd,
  }

  return { story, chapter, prev, next, meta }
}

// ─── Catalog SEO ───────────────────────────────────────────────────────────

export interface CatalogPageResult {
  groups: Array<{ query: { sort: 'new' | 'hot'; limit: number }; stories: StoryRenderDto[]; meta: { limit: number; hasMore: boolean; nextCursor: string | null } }>
  stories: StoryRenderDto[]
  meta: PageMeta
}

export const getCatalogPage = async (
  kind: 'home' | 'stories' | 'ranking'
): Promise<CatalogPageResult> => {
  let title: string
  let description: string
  let canonical: string

  switch (kind) {
    case 'home':
      title = `${SITE_NAME} — Đọc truyện chữ online miễn phí`
      description = DEFAULT_DESCRIPTION
      canonical = buildCanonical('/')
      break
    case 'stories':
      title = `Kho truyện — ${SITE_NAME}`
      description = `Khám phá hàng nghìn truyện chữ đa thể loại tại ${SITE_NAME}`
      canonical = buildCanonical('/stories')
      break
    case 'ranking':
      title = `Bảng xếp hạng — ${SITE_NAME}`
      description = `Top truyện được đọc nhiều nhất, được yêu thích nhất tại ${SITE_NAME}`
      canonical = buildCanonical('/ranking')
      break
  }

  // Lấy tối đa 20 stories approved mới nhất để hydrate links crawl được
  const queries = kind === 'home' ? [{ sort: 'hot' as const, limit: 12 }, { sort: 'new' as const, limit: 12 }] : [{ sort: kind === 'ranking' ? 'hot' as const : 'new' as const, limit: kind === 'stories' ? 24 : 20 }]
  const groups = await Promise.all(queries.map(async query => {
    const result = kind === 'ranking' ? await storyRepository.getRanking({ metric: 'views', period: 'all', limit: 20, seoProjection: true }) : await storyRepository.findStories({ ...query, seoProjection: true })
    return { query, stories: result.stories.map(story => mapStoryToDto(story)), meta: result.meta }
  }))
  const stories = groups[0].stories

  const meta: PageMeta = {
    title,
    description,
    canonical,
    indexable: env.SEO_INDEXABLE,
    contentWarning: 'none',
    og: {
      title,
      description,
      url: canonical,
      image: DEFAULT_OG_IMAGE,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      image: DEFAULT_OG_IMAGE,
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: buildCanonical('/'),
    },
  }


  return { stories, meta, groups }
}

// ─── Cover ─────────────────────────────────────────────────────────────────

export const getCoverData = async (
  storyId: string
): Promise<{ coverUrl: string | null }> => {
  const result = await seoRepository.findCoverForPublicStory(storyId)
  if (!result) throw AppError.notFound('Ảnh bìa không tìm thấy hoặc truyện không công khai', 'COVER_NOT_FOUND')
  return result
}

// ─── Sitemap ───────────────────────────────────────────────────────────────

export interface SitemapShardResult {
  storyEntries?: SitemapStoryEntry[]
  chapterEntries?: SitemapChapterEntry[]
  kind: 'stories' | 'chapters'
}

/**
 * Hydrate một shard từ manifest Redis và kiểm tra visibility hiện tại.
 * Không trả data từ cache XML cũ — luôn đọc lại Mongo.
 */
export const hydrateSitemapShard = async (
  ids: string[],
  kind: 'stories' | 'chapters'
): Promise<SitemapShardResult> => {
  if (kind === 'stories') {
    const storyEntries = await seoRepository.hydrateStoryIdsForSitemap(ids)
    return { storyEntries, kind }
  } else {
    const chapterEntries = await seoRepository.hydrateChapterIdsForSitemap(ids)
    return { chapterEntries, kind }
  }
}

/**
 * Scan toàn bộ IDs để build sitemap manifest trong Redis.
 * Trả danh sách shards (mỗi shard tối đa 1000 IDs).
 */
export const buildSitemapManifestData = async (
  kind: 'stories' | 'chapters',
  signal?: AbortSignal
): Promise<{ shards: string[][] }> => {
  const SHARD_SIZE = 1000
  let bytes = 0
  const shards: string[][] = []
  let afterId: string | undefined

  while (true) {
    signal?.throwIfAborted()
    if (shards.length >= 10000) throw new Error('Sitemap manifest budget exceeded')
    const { ids, lastId } =
      kind === 'stories'
        ? await seoRepository.scanStoryIds(afterId, SHARD_SIZE)
        : await seoRepository.scanChapterIds(afterId, SHARD_SIZE)

    if (ids.length === 0) break
    bytes += ids.reduce((sum, id) => sum + Buffer.byteLength(id) + 3, 2)
    if (bytes > 16 * 1024 * 1024) throw new Error('Sitemap manifest budget exceeded')

    // Chia nhỏ nếu batch trả đủ 1000
    for (let i = 0; i < ids.length; i += SHARD_SIZE) {
      shards.push(ids.slice(i, i + SHARD_SIZE))
    }

    if (ids.length < SHARD_SIZE) break
    if (!lastId || lastId === afterId) throw new Error('Sitemap cursor did not advance')
    afterId = lastId
  }

  logger.info(`[SEO] Sitemap manifest built: ${shards.length} shards for ${kind}`)
  return { shards }
}

export const seoService = {
  getStoryToc: async (slug: string, cursor?: string, limit?: number) => {
    const story = await seoRepository.findPublicStoryBySlug(slug)
    if (!story) throw AppError.notFound('Truyện không tồn tại', 'STORY_NOT_FOUND')
    return seoRepository.findPublicToc(story._id, cursor, limit)
  },
  getStoryPage,
  getChapterPage,
  getCatalogPage,
  getCoverData,
  hydrateSitemapShard,
  buildSitemapManifestData,
}
