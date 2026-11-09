/**
 * SEO Repository — Phase 8
 *
 * Read-only projections dành cho render metadata, sitemap và cover endpoint.
 * KHÔNG gọi incrementViewCount, KHÔNG ghi history, KHÔNG populate email/role.
 * Visibility check: approved story + published+approved chapter.
 */
import { createHash } from 'node:crypto'
import { chapterSlugFilter } from '../common/chapterUrl.js'
import { Types, FilterQuery } from 'mongoose'
import { Story, IStory, StoryModerationStatus, type StoryRecord } from '../models/Story.model.js'
import { Chapter, IChapter } from '../models/Chapter.model.js'
import { sanitizeHtml } from '../common/sanitizeHtml.js'
import { AppError } from '../common/AppError.js'
import { encodeCursor, decodeCursor } from '../common/pagination.js'

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface StoryRenderDto {
  _id: string
  slug: string
  title: string
  description: string
  coverUrl?: string
  contentWarning: string
  status: string
  moderationStatus: StoryModerationStatus
  chapterCount: number
  viewCount: number
  followCount: number
  ratingAverage: number
  ratingCount: number
  originalAuthor?: string
  sourceName?: string
  author: {
    username: string
    displayName: string
  } | null
  genres: Array<{ _id: string; name: string; slug: string }>
  tags: Array<{ _id: string; name: string; slug: string }>
  createdAt: string
  updatedAt: string
}

export interface ChapterRenderDto {
  _id: string
  storyId: string
  slug: string
  title: string
  order: number
  contentHtml: string
  wordCount: number
  status: string
  moderationStatus: string
  viewCount: number
  createdAt: string
  updatedAt: string
}

export interface TocItemDto {
  _id: string
  storyId: string
  slug: string
  title: string
  order: number
  status: string
  moderationStatus: string
  viewCount: number
  createdAt: string
  publishAt?: string
}

export interface SitemapStoryEntry {
  _id: string
  slug: string
}

export interface SitemapChapterEntry {
  _id: string
  slug: string
  storySlug: string
}

// ─── Story SEO ─────────────────────────────────────────────────────────────

/** Map một Mongoose Story document → StoryRenderDto (không expose email/role). */
export function mapStoryToDto(story: StoryRecord): StoryRenderDto {
  const authorRaw = story.authorId as unknown as
    | { username?: string; displayName?: string }
    | null

  return {
    _id: story._id.toString(),
    slug: story.slug,
    title: story.title,
    description: story.contentWarning === 'mature18+' ? 'Nội dung dành cho độc giả 18+.' : story.description,
    coverUrl: story.contentWarning === 'mature18+' ? undefined : ((story as IStory & { hasCover?: boolean }).hasCover || story.coverUrl) ? '/seo/covers/' + story._id.toString() : undefined,
    contentWarning: story.contentWarning,
    status: story.status,
    moderationStatus: story.moderationStatus,
    chapterCount: story.chapterCount,
    viewCount: story.viewCount,
    followCount: story.followCount,
    ratingAverage: story.ratingAverage,
    ratingCount: story.ratingCount,
    originalAuthor: story.originalAuthor,
    sourceName: story.sourceName,
    author: authorRaw
      ? {
          username: authorRaw.username ?? '',
          displayName: authorRaw.displayName ?? authorRaw.username ?? '',
        }
      : null,
    genres: (
      story.genreIds as unknown as Array<{ _id: Types.ObjectId; name?: string; slug?: string }>
    ).map((g) => ({ _id: String(g._id), name: g.name ?? '', slug: g.slug ?? '' })),
    tags: (
      story.tagIds as unknown as Array<{ _id: Types.ObjectId; name?: string; slug?: string }>
    ).map((t) => ({ _id: String(t._id), name: t.name ?? '', slug: t.slug ?? '' })),
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
  }
}

/** Lấy story public theo slug để render metadata. */
export const findPublicStoryBySlug = async (
  slug: string
): Promise<StoryRenderDto | null> => {
  const story = await Story.findOne({ slug, moderationStatus: 'approved' })
    .select(
      'slug title description contentWarning status moderationStatus chapterCount viewCount followCount ratingAverage ratingCount originalAuthor sourceName authorId genreIds tagIds createdAt updatedAt'
    )
    .select({ hasCover: { $gt: [{ $strLenBytes: { $ifNull: ['$coverUrl', ''] } }, 0] } })
    .populate('authorId', 'username displayName')
    .populate('genreIds', 'name slug')
    .populate('tagIds', 'name slug')
    .maxTimeMS(2500).lean() as unknown as IStory | null

  if (!story) return null
  return mapStoryToDto(story)
}

/** Lấy TOC public (chỉ published+approved) phục vụ SSR story detail. */
export const findPublicToc = async (
  storyId: string,
  cursor?: string,
  limit = 50
): Promise<{ items: TocItemDto[]; nextCursor: string | null; hasMore: boolean }> => {
  if (!Types.ObjectId.isValid(storyId)) return { items: [], nextCursor: null, hasMore: false }

  const filter: FilterQuery<IChapter> = {
    storyId: new Types.ObjectId(storyId),
    status: 'published',
    moderationStatus: 'approved',
  }

  const context = createHash('sha256').update(JSON.stringify([storyId, false, 'asc', '', ''])).digest('hex')
  if (cursor) {
    const decoded = decodeCursor<{ order: number; _id: string; context: string }>(cursor)
    if (!decoded || decoded.context !== context || !Number.isSafeInteger(decoded.order) || !Types.ObjectId.isValid(decoded._id)) throw AppError.badRequest('Cursor không hợp lệ', 'INVALID_CURSOR')
    if (decoded && Number.isSafeInteger(decoded.order) && Types.ObjectId.isValid(decoded._id)) {
      filter.$or = [
        { order: { $gt: decoded.order } },
        { order: decoded.order, _id: { $gt: new Types.ObjectId(decoded._id) } },
      ]
    }
  }

  const results = await Chapter.find(filter)
    .sort({ order: 1, _id: 1 })
    .limit(limit + 1)
    .select('_id storyId slug title order status moderationStatus publishAt viewCount createdAt')
    .maxTimeMS(2500).lean()

  const hasMore = results.length > limit
  const items = results.slice(0, limit)
  const last = items.at(-1)

  const nextCursor =
    hasMore && last
      ? encodeCursor({ order: last.order, _id: String(last._id), context })
      : null

  return {
    items: items.map((c) => ({
      _id: String(c._id),
      storyId: String(c.storyId),
      slug: `chuong-${c.order}`,
      title: c.title,
      order: c.order,
      status: c.status,
      moderationStatus: c.moderationStatus,
      viewCount: c.viewCount,
      createdAt: c.createdAt.toISOString(),
      publishAt: c.publishAt?.toISOString(),
    })),
    nextCursor,
    hasMore,
  }
}

// ─── Chapter SEO ───────────────────────────────────────────────────────────

/** Lấy chapter public theo storySlug + chapterSlug (cùng lúc verify parent approved). */
export const findPublicChapter = async (
  storySlug: string,
  chapterSlug: string
): Promise<{
  story: StoryRenderDto
  chapter: ChapterRenderDto
  prev: { slug: string; title: string; order: number } | null
  next: { slug: string; title: string; order: number } | null
} | null> => {
  const story = await Story.findOne({ slug: storySlug, moderationStatus: 'approved' })
    .select(
      'slug title description contentWarning status moderationStatus chapterCount viewCount followCount ratingAverage ratingCount originalAuthor sourceName authorId genreIds tagIds createdAt updatedAt'
    )
    .select({ hasCover: { $gt: [{ $strLenBytes: { $ifNull: ['$coverUrl', ''] } }, 0] } })
    .populate('authorId', 'username displayName')
    .populate('genreIds', 'name slug')
    .populate('tagIds', 'name slug')
    .maxTimeMS(2500).lean() as unknown as IStory | null

  if (!story) return null

  const chapter = await Chapter.findOne({
    storyId: story._id,
    ...chapterSlugFilter(chapterSlug),
    status: 'published',
    moderationStatus: 'approved',
  })
    .select('_id storyId slug title order contentHtml wordCount status moderationStatus viewCount createdAt updatedAt')
    .maxTimeMS(2500).lean()

  if (!chapter) return null

  // Prev / Next (không expose private chapters)
  const [prevDoc, nextDoc] = await Promise.all([
    Chapter.findOne({
      storyId: story._id,
      status: 'published',
      moderationStatus: 'approved',
      order: { $lt: chapter.order },
    })
      .sort({ order: -1 })
      .select('slug title order')
      .maxTimeMS(2500).lean(),
    Chapter.findOne({
      storyId: story._id,
      status: 'published',
      moderationStatus: 'approved',
      order: { $gt: chapter.order },
    })
      .sort({ order: 1 })
      .select('slug title order')
      .maxTimeMS(2500).lean(),
  ])

  return {
    story: mapStoryToDto(story),
    chapter: {
      _id: String(chapter._id),
      storyId: String(chapter.storyId),
      slug: `chuong-${chapter.order}`,
      title: chapter.title,
      order: chapter.order,
      contentHtml: story.contentWarning === 'mature18+' ? '' : sanitizeHtml(chapter.contentHtml),
      wordCount: chapter.wordCount ?? 0,
      status: chapter.status,
      moderationStatus: chapter.moderationStatus,
      viewCount: chapter.viewCount ?? 0,
      createdAt: (chapter.createdAt as Date).toISOString(),
      updatedAt: (chapter.updatedAt as Date).toISOString(),
    },
    prev: prevDoc
      ? { slug: `chuong-${prevDoc.order}`, title: prevDoc.title, order: prevDoc.order }
      : null,
    next: nextDoc
      ? { slug: `chuong-${nextDoc.order}`, title: nextDoc.title, order: nextDoc.order }
      : null,
  }
}

// ─── Cover ─────────────────────────────────────────────────────────────────

/** Lấy coverUrl của story public (không mature). Dùng cho endpoint /seo/covers/:storyId. */
export const findCoverForPublicStory = async (
  storyId: string
): Promise<{ coverUrl: string | null } | null> => {
  if (!Types.ObjectId.isValid(storyId)) return null

  const story = await Story.findOne({
    _id: new Types.ObjectId(storyId),
    moderationStatus: 'approved',
    contentWarning: 'none',
  })
    .select('coverUrl')
    .maxTimeMS(2500).lean()

  if (!story) return null
  return { coverUrl: story.coverUrl ?? null }
}

// ─── Sitemap ───────────────────────────────────────────────────────────────

/** Quét ID story theo cursor (batch) — dùng cho sitemap manifest job. */
export const scanStoryIds = async (
  afterId?: string,
  limit = 1000
): Promise<{ ids: string[]; lastId: string | null }> => {
  const filter: FilterQuery<IStory> = {}
  if (afterId && Types.ObjectId.isValid(afterId)) {
    filter._id = { $gt: new Types.ObjectId(afterId) }
  }
  const docs = await Story.find(filter)
    .sort({ _id: 1 })
    .limit(limit)
    .select('_id')
    .maxTimeMS(2500).lean()

  const ids = docs.map((d) => String(d._id))
  return { ids, lastId: ids.at(-1) ?? null }
}

/** Quét ID chapter theo cursor (batch) — dùng cho sitemap manifest job. */
export const scanChapterIds = async (
  afterId?: string,
  limit = 1000
): Promise<{ ids: string[]; lastId: string | null }> => {
  const filter: FilterQuery<IChapter> = {}
  if (afterId && Types.ObjectId.isValid(afterId)) {
    filter._id = { $gt: new Types.ObjectId(afterId) }
  }
  const docs = await Chapter.find(filter)
    .sort({ _id: 1 })
    .limit(limit)
    .select('_id')
    .maxTimeMS(2500).lean()

  const ids = docs.map((d) => String(d._id))
  return { ids, lastId: ids.at(-1) ?? null }
}

/**
 * Hydrate story IDs → public slug entries (kiểm tra visibility hiện tại mỗi lần serve).
 * Mature stories bị loại vì không indexable theo policy.
 */
export const hydrateStoryIdsForSitemap = async (
  ids: string[]
): Promise<SitemapStoryEntry[]> => {
  const validIds = ids.filter((id) => Types.ObjectId.isValid(id))
  if (validIds.length === 0) return []

  const docs = await Story.find({
    _id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
    moderationStatus: 'approved',
    contentWarning: 'none',
  })
    .select('_id slug')
    .maxTimeMS(2500).lean()

  return docs.map((d) => ({ _id: String(d._id), slug: d.slug }))
}

/**
 * Hydrate chapter IDs → public entries với storySlug (N+1 avoided via aggregation).
 * Chapter phải published+approved và parent story approved+non-mature.
 */
export const hydrateChapterIdsForSitemap = async (
  ids: string[]
): Promise<SitemapChapterEntry[]> => {
  const validIds = ids.filter((id) => Types.ObjectId.isValid(id))
  if (validIds.length === 0) return []

  type ChapterWithStory = {
    _id: Types.ObjectId
    slug: string
    storySlug: string
  }

  const docs = await Chapter.aggregate<ChapterWithStory>([
    {
      $match: {
        _id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
        status: 'published',
        moderationStatus: 'approved',
      },
    },
    {
      $lookup: {
        from: 'stories',
        localField: 'storyId',
        foreignField: '_id',
        as: 'story',
        pipeline: [
          {
            $match: { moderationStatus: 'approved', contentWarning: 'none' },
          },
          { $project: { slug: 1 } },
        ],
      },
    },
    { $match: { 'story.0': { $exists: true } } },
    {
      $project: {
        _id: 1,
        slug: 1,
        storySlug: { $arrayElemAt: ['$story.slug', 0] },
      },
    },
  ]).option({ maxTimeMS: 5000 })

  return docs.map((d) => ({
    _id: String(d._id),
    slug: d.slug,
    storySlug: d.storySlug,
  }))
}

export const seoRepository = {
  findPublicStoryBySlug,
  findPublicToc,
  findPublicChapter,
  findCoverForPublicStory,
  scanStoryIds,
  scanChapterIds,
  hydrateStoryIdsForSitemap,
  hydrateChapterIdsForSitemap,
}
