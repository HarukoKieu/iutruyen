import mongoose, { Types, FilterQuery, PipelineStage } from 'mongoose'
import { Chapter } from '../models/Chapter.model.js'
import { createHash } from 'node:crypto'
import { AppError } from '../common/AppError.js'
import { Story, IStory, StoryStatus, StoryModerationStatus, type StoryRecord } from '../models/Story.model.js'
import { User } from '../models/User.model.js'
import { removeRetiredAccessFields } from '../common/freeContent.js'
import {
  encodeCursor,
  decodeCursor,
  buildCursorMeta,
  CursorPaginationMeta,
} from '../common/pagination.js'

const seoProjection = {
  title: 1, slug: 1, description: 1, contentWarning: 1, status: 1, moderationStatus: 1,
  chapterCount: 1, viewCount: 1, followCount: 1, ratingAverage: 1, ratingCount: 1,
  originalAuthor: 1, sourceName: 1, authorId: 1, genreIds: 1, tagIds: 1, createdAt: 1, updatedAt: 1,
  coverUrl: { $cond: [{ $gt: [{ $strLenBytes: { $ifNull: ['$coverUrl', ''] } }, 0] }, { $concat: ['/seo/covers/', { $toString: '$_id' }] }, null] },
}
const catalogProjection = {
  ...seoProjection, isFeatured: 1,
  coverUrl: { $cond: [{ $gt: [{ $strLenBytes: { $ifNull: ['$coverUrl', ''] } }, 0] }, { $concat: ['/api/v1/stories/', { $toString: '$_id' }, '/cover'] }, null] },
}

const getAuthorIdsByQuery = async (query: string): Promise<Types.ObjectId[]> => {
  const trimmed = query.trim()
  if (!trimmed) return []
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    const users = await User.find({
      $or: [
        { displayName: { $regex: escaped, $options: 'i' } },
        { username: { $regex: escaped, $options: 'i' } },
      ],
    })
      .select('_id')
      .lean()
    return users.map((u) => u._id as Types.ObjectId)
  } catch (err) {
    return []
  }
}

export interface StoryFilterOptions {
  seoProjection?: boolean
  catalogProjection?: boolean
  cursor?: string | null
  limit: number
  genreId?: string
  tagId?: string
  authorId?: string
  status?: StoryStatus
  moderationStatus?: StoryModerationStatus
  sort?: 'new' | 'hot' | 'top-week' | 'top-month' | 'top-year' | 'rating' | 'chapters'
  q?: string
}

export interface StoryPaginatedResult {
  stories: StoryRecord[]
  meta: CursorPaginationMeta
}

export interface StoryRankingOptions {
  seoProjection?: boolean
  catalogProjection?: boolean
  metric?: 'views' | 'follows' | 'rating' | 'chapters'
  period?: 'all' | 'month' | 'week'
  genreId?: string
  cursor?: string | null
  limit: number
}

export interface StoryRankingResult {
  stories: StoryRecord[]
  meta: CursorPaginationMeta
}

export const create = async (data: Partial<IStory>): Promise<IStory> => {
  return Story.create(data)
}

export const findById = async (id: string): Promise<IStory | null> => {
  return Story.findById(id)
    .populate('authorId', 'username displayName avatarUrl role authorStatus')
    .populate('genreIds', 'name slug description')
    .populate('tagIds', 'name slug')
}

export const findBySlug = async (slug: string): Promise<IStory | null> => {
  return Story.findOne({ slug })
    .populate('authorId', 'username displayName avatarUrl role authorStatus bio')
    .populate('genreIds', 'name slug description')
    .populate('tagIds', 'name slug')
}
export const findPublicCover = async (id: string) => Story.findOne({ _id: id, moderationStatus: 'approved' }).select('coverUrl').maxTimeMS(2500).lean()

export const updateById = async (
  id: string,
  updateData: Partial<IStory>
): Promise<IStory | null> => {
  // A cached chapter count supplied by a caller may already be stale. Serialize
  // recounts on the parent before reading chapters in a transaction snapshot.
  if (updateData.chapterCount !== undefined) {
    return mongoose.connection.transaction(async session => {
      const parent = await Story.findByIdAndUpdate(id, { $inc: { __v: 1 } }, { session, new: true })
      if (!parent) return null
      const chapterCount = await Chapter.countDocuments({ storyId: parent._id, status: 'published', moderationStatus: 'approved' }).session(session)
      return Story.findByIdAndUpdate(id, { $set: { ...updateData, chapterCount } }, { session, new: true, runValidators: true })
        .populate('authorId', 'username displayName avatarUrl role authorStatus')
        .populate('genreIds', 'name slug').populate('tagIds', 'name slug')
    })
  }
  return Story.findByIdAndUpdate(id, { $set: updateData, $inc: { __v: 1 } }, { new: true, runValidators: true })
    .populate('authorId', 'username displayName avatarUrl role authorStatus')
    .populate('genreIds', 'name slug')
    .populate('tagIds', 'name slug')
}

export const softDeleteById = async (id: string): Promise<IStory | null> => {
  return Story.findByIdAndUpdate(
    id,
    { $set: { moderationStatus: 'removed' } },
    { new: true }
  )
}

export const findStories = async (
  options: StoryFilterOptions
): Promise<StoryPaginatedResult> => {
  const {
    cursor,
    limit,
    genreId,
    tagId,
    authorId,
    status,
    moderationStatus,
    sort = 'new',
    q,
  } = options

  const filter: FilterQuery<IStory> = {}

  if (moderationStatus) {
    filter.moderationStatus = moderationStatus
  } else if (!authorId) {
    filter.moderationStatus = 'approved'
  } else {
    filter.moderationStatus = { $ne: 'removed' }
  }

  if (status) {
    filter.status = status
  }

  if (authorId && authorId !== 'undefined' && Types.ObjectId.isValid(authorId)) {
    filter.authorId = new Types.ObjectId(authorId)
  }

  if (genreId) {
    filter.genreIds = new Types.ObjectId(genreId)
  }

  if (tagId) {
    filter.tagIds = new Types.ObjectId(tagId)
  }

  if (q && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const authorIds = await getAuthorIdsByQuery(q)
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      ...(authorIds.length > 0 ? [{ authorId: { $in: authorIds } }] : []),
    ]
  }

  // Determine sort field and direction
  let sortField: keyof IStory = 'createdAt'
  switch (sort) {
    case 'hot':
    case 'top-week':
    case 'top-year':
      sortField = 'viewCount'
      break
    case 'top-month':
      sortField = 'followCount'
      break
    case 'rating':
      sortField = 'ratingAverage'
      break
    case 'chapters':
      sortField = 'chapterCount'
      break
    case 'new':
    default:
      sortField = 'createdAt'
      break
  }

  // Handle cursor conditions
  if (cursor) {
    const decoded = decodeCursor<{ v: any; _id: string }>(cursor)
    if (decoded && decoded._id) {
      const cursorId = new Types.ObjectId(decoded._id)
      const cursorVal = sortField === 'createdAt' ? new Date(decoded.v) : decoded.v

      const cursorCondition = [
        { [sortField]: { $lt: cursorVal } },
        { [sortField]: cursorVal, _id: { $lt: cursorId } },
      ]

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: cursorCondition }]
        delete filter.$or
      } else {
        filter.$or = cursorCondition
      }
    }
  }

  // Fetch limit + 1 items to determine if there are more
  const items = await Story.find(filter).select(options.seoProjection ? seoProjection : options.catalogProjection ? catalogProjection : {}).maxTimeMS(3000)
    .sort({ [sortField]: -1, _id: -1 })
    .limit(limit + 1)
    .populate('authorId', options.seoProjection ? 'username displayName' : 'username displayName avatarUrl role')
    .populate('genreIds', 'name slug')
    .populate('tagIds', 'name slug')
    .lean()

  const hasMore = items.length > limit
  const resultStories = hasMore ? items.slice(0, limit) : items
  resultStories.forEach(removeRetiredAccessFields)

  let nextCursor: string | null = null
  if (hasMore && resultStories.length > 0) {
    const lastItem = resultStories[resultStories.length - 1]
    const rawVal = (lastItem as any)[sortField]
    const sortVal = rawVal instanceof Date ? rawVal.toISOString() : rawVal
    nextCursor = encodeCursor({
      v: sortVal,
      _id: lastItem._id.toString(),
    })
  }

  return {
    stories: resultStories,
    meta: buildCursorMeta(limit, nextCursor, hasMore),
  }
}

export const incrementViewCount = async (id: string | Types.ObjectId): Promise<void> => {
  await Story.findByIdAndUpdate(id, { $inc: { viewCount: 1 } })
}

export const updateRating = async (
  id: string | Types.ObjectId,
  ratingAverage: number,
  ratingCount: number
): Promise<void> => {
  await Story.findByIdAndUpdate(id, { ratingAverage, ratingCount })
}

export const getRanking = async (
  options: StoryRankingOptions
): Promise<StoryRankingResult> => {
  const { metric = 'views', genreId, cursor, limit = 20 } = options

  const filter: FilterQuery<IStory> = {
    moderationStatus: 'approved',
  }

  if (genreId) {
    filter.genreIds = new Types.ObjectId(genreId)
  }

  // Determine sort field
  let sortField: keyof IStory = 'viewCount'
  switch (metric) {
    case 'follows':
      sortField = 'followCount'
      break
    case 'rating':
      sortField = 'ratingAverage'
      break
    case 'chapters':
      sortField = 'chapterCount'
      break
    case 'views':
    default:
      sortField = 'viewCount'
      break
  }

  // Handle cursor condition
  if (cursor) {
    const decoded = decodeCursor<{ v: any; _id: string }>(cursor)
    if (decoded && decoded._id) {
      const cursorId = new Types.ObjectId(decoded._id)
      const cursorVal = decoded.v

      filter.$or = [
        { [sortField]: { $lt: cursorVal } },
        { [sortField]: cursorVal, _id: { $lt: cursorId } },
      ]
    }
  }

  // Fetch limit + 1 items to determine if there are more
  const items = await Story.find(filter)
    .select(options.seoProjection ? seoProjection : options.catalogProjection ? catalogProjection : {}).maxTimeMS(3000)
    .sort({ [sortField]: -1, _id: -1 })
    .limit(limit + 1)
    .populate('authorId', options.seoProjection ? 'username displayName' : 'username displayName avatarUrl role')
    .populate('genreIds', 'name slug')
    .populate('tagIds', 'name slug')
    .lean()

  const hasMore = items.length > limit
  const resultStories = hasMore ? items.slice(0, limit) : items

  let nextCursor: string | null = null
  if (hasMore && resultStories.length > 0) {
    const lastItem = resultStories[resultStories.length - 1]
    const rawVal = (lastItem as any)[sortField]
    nextCursor = encodeCursor({
      v: rawVal,
      _id: lastItem._id.toString(),
    })
  }

  return {
    stories: resultStories,
    meta: buildCursorMeta(limit, nextCursor, hasMore),
  }
}

export const countPendingModeration = async (): Promise<number> => {
  return Story.countDocuments({ moderationStatus: 'pending' })
}

export const findModerationQueue = async (options: {
  filter: FilterQuery<IStory>
  sortDirection: 1 | -1
  limit: number
}): Promise<IStory[]> => {
  return Story.find(options.filter)
    .sort({ createdAt: options.sortDirection, _id: options.sortDirection })
    .limit(options.limit + 1)
    .populate('authorId', 'displayName username avatarUrl email role')
    .populate('genreIds', 'name slug')
    .populate('tagIds', 'name slug')
}

export const findByIdForModeration = async (id: string): Promise<IStory | null> => {
  return Story.findById(id).populate('authorId', 'displayName username email')
}

export const findByIdForReportTarget = async (id: string): Promise<IStory | null> => {
  return Story.findById(id)
    .populate('authorId', 'displayName username avatarUrl email role')
    .populate('genreIds', 'name slug')
}

export const updateModerationStatus = async (
  id: string | Types.ObjectId,
  moderationStatus: StoryModerationStatus
): Promise<IStory | null> => {
  return Story.findByIdAndUpdate(id, { $set: { moderationStatus } }, { new: true })
}

export interface StorySearchOptions {
  q?: string
  genreId?: string
  status?: StoryStatus
  rating?: number
  sort?: 'relevance' | 'views' | 'rating' | 'newest' | 'chapters'
  cursor?: string | null
  limit: number
}

export interface QuickSuggestionStory {
  _id: Types.ObjectId
  title: string
  slug: string
  coverUrl?: string
  ratingAverage: number
  viewCount: number
  status: StoryStatus
  authorId?: {
    displayName?: string
    username?: string
  }
  genreIds: Array<{
    name: string
    slug: string
  }>
}

type SearchCursorValue = string | number

export const searchStories = async (options: StorySearchOptions): Promise<StoryPaginatedResult> => {
  const { q, genreId, status, rating, sort = 'relevance', cursor, limit = 20 } = options
  const text = q?.trim()
  const filter: FilterQuery<IStory> = { moderationStatus: 'approved' }
  if (genreId) filter.genreIds = new Types.ObjectId(genreId)
  if (status) filter.status = status
  if (rating) filter.ratingAverage = { $gte: rating }
  if (text) filter.$text = { $search: text }
  const field = sort === 'relevance' && text ? 'score' : sort === 'rating' ? 'ratingAverage' : sort === 'newest' ? 'createdAt' : sort === 'chapters' ? 'chapterCount' : 'viewCount'
  const context = createHash('sha256').update(JSON.stringify([text || '', genreId || '', status || '', rating || 0, sort])).digest('hex')
  const pipeline: PipelineStage[] = [{ $match: filter }]
  if (field === 'score') pipeline.push({ $set: { score: { $meta: 'textScore' } } })
  if (cursor) {
    const value = decodeCursor<{ v: number | string; _id: string; context: string }>(cursor)
    if (!value || value.context !== context || !Types.ObjectId.isValid(value._id) ||
      (field === 'createdAt' ? typeof value.v !== 'string' || !Number.isFinite(Date.parse(value.v)) : typeof value.v !== 'number' || !Number.isFinite(value.v))) {
      throw AppError.badRequest('Cursor không hợp lệ hoặc không thuộc bộ lọc hiện tại', 'INVALID_CURSOR')
    }
    const v = field === 'createdAt' ? new Date(value.v) : value.v
    pipeline.push({ $match: { $or: [{ [field]: { $lt: v } }, { [field]: v, _id: { $lt: new Types.ObjectId(value._id) } }] } })
  }
  pipeline.push({ $sort: { [field]: -1, _id: -1 } }, { $limit: limit + 1 })
  const items = await Story.aggregate<IStory & { score?: number }>(pipeline).option({ maxTimeMS: 3000 })
  const hasMore = items.length > limit
  const stories = items.slice(0, limit)
  const last = stories.at(-1)
  const raw = last ? last[field as keyof typeof last] : undefined
  const nextCursor = hasMore && last ? encodeCursor({ v: raw instanceof Date ? raw.toISOString() : Number(raw), _id: String(last._id), context }) : null
  await Story.populate(stories, [{ path: 'authorId', select: 'username displayName avatarUrl role' }, { path: 'genreIds', select: 'name slug' }, { path: 'tagIds', select: 'name slug' }])
  for (const story of stories) {
    delete story.score
    removeRetiredAccessFields(story as unknown as Record<string, unknown>)
  }
  return { stories, meta: buildCursorMeta(limit, nextCursor, hasMore) }
}

export const findPublicSuggestionsByIds = async (ids: string[]): Promise<QuickSuggestionStory[]> => {
  const validIds = ids.filter(id => Types.ObjectId.isValid(id)).slice(0, 5)
  const stories = await Story.find({ _id: { $in: validIds }, moderationStatus: 'approved' })
    .select('title slug coverUrl ratingAverage viewCount status authorId genreIds')
    .populate('authorId', 'displayName username').populate('genreIds', 'name slug').lean() as unknown as QuickSuggestionStory[]
  const byId = new Map(stories.map(story => [String(story._id), story]))
  return validIds.flatMap(id => { const story = byId.get(id); return story ? [story] : [] })
}

export const findQuickSuggestions = async (
  q: string,
  limit: number = 5
): Promise<QuickSuggestionStory[]> => {
  const trimmed = q.trim()
  const filter: FilterQuery<IStory> = {
    moderationStatus: 'approved',
  }

  if (trimmed) {
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const authorIds = await getAuthorIdsByQuery(trimmed)
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      ...(authorIds.length > 0 ? [{ authorId: { $in: authorIds } }] : []),
    ]
  }

  return Story.find(filter)
    .sort({ viewCount: -1, ratingAverage: -1 })
    .limit(limit)
    .select('title slug coverUrl ratingAverage viewCount authorId originalAuthor sourceName description genreIds status chapterCount')
    .populate('authorId', 'displayName username avatarUrl')
    .populate('genreIds', 'name slug')
    .lean() as unknown as QuickSuggestionStory[]
}

export const storyRepository = {
  findPublicCover,
  create,
  findById,
  findBySlug,
  updateById,
  softDeleteById,
  findStories,
  incrementViewCount,
  updateRating,
  getRanking,
  countPendingModeration,
  findModerationQueue,
  findByIdForModeration,
  findByIdForReportTarget,
  updateModerationStatus,
  searchStories,
  findQuickSuggestions,
  findPublicSuggestionsByIds,
}

