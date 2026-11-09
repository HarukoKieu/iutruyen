import { Chapter, IChapter } from '../models/Chapter.model.js'
import { Story } from '../models/Story.model.js'
import { chapterSlugFilter } from '../common/chapterUrl.js'
import mongoose, { Types, FilterQuery } from 'mongoose'
import { recountChapterCount } from './content-counters.js'
import { PUBLIC_CHAPTER_FILTER } from '../common/contentVisibility.js'
import { encodeCursor, decodeCursor, buildCursorMeta } from '../common/pagination.js'
import { AppError } from '../common/AppError.js'
import type { ChapterListQuery } from '../modules/chapters/chapters.validation.js'
import { createHash } from 'node:crypto'

export interface CreateChapterInput {
  storyId: string | Types.ObjectId
  title: string
  slug: string
  order: number
  contentHtml: string
  status?: 'draft' | 'scheduled' | 'published'
  moderationStatus?: 'pending' | 'approved' | 'hidden'
  wordCount?: number
  publishAt?: Date
}

export interface UpdateChapterInput {
  moderationStatus?: 'pending' | 'approved' | 'hidden'
  title?: string
  slug?: string
  order?: number
  contentHtml?: string
  status?: 'draft' | 'scheduled' | 'published'
  wordCount?: number
  publishAt?: Date
}

export const chapterRepository = {
  async findChapterPage(storyId: Types.ObjectId, preview: boolean, query: ChapterListQuery) {
    const direction = query.sort === 'desc' ? -1 : 1
    const context = createHash('sha256').update(JSON.stringify([String(storyId), preview, query.sort, query.q || '', query.chapterId || ''])).digest('hex')
    const filter: FilterQuery<IChapter> = { storyId, ...(preview ? {} : PUBLIC_CHAPTER_FILTER) }
    if (query.chapterId) filter._id = new Types.ObjectId(query.chapterId)
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [{ title: { $regex: escaped, $options: 'i' } }, ...(Number.isSafeInteger(Number(query.q)) ? [{ order: Number(query.q) }] : [])]
    }
    if (query.cursor) {
      const cursor = decodeCursor<{ order: number; _id: string; context: string }>(query.cursor)
      if (!cursor || cursor.context !== context || !Number.isSafeInteger(cursor.order) || !Types.ObjectId.isValid(cursor._id)) throw AppError.badRequest('Cursor không hợp lệ', 'INVALID_CURSOR')
      const op = direction === 1 ? '$gt' : '$lt'
      filter.$and = [{ $or: [{ order: { [op]: cursor.order } }, { order: cursor.order, _id: { [op]: new Types.ObjectId(cursor._id) } }] }]
    }
    const results = await Chapter.find(filter).sort({ order: direction, _id: direction }).limit(query.limit + 1)
      .select('_id storyId title slug order status moderationStatus publishAt viewCount createdAt').lean()
    const hasMore = results.length > query.limit
    const items = results.slice(0, query.limit)
    const last = items.at(-1)
    return { items, meta: buildCursorMeta(query.limit, hasMore && last ? encodeCursor({ order: last.order, _id: String(last._id), context }) : null, hasMore) }
  },
  async findById(id: string | Types.ObjectId): Promise<IChapter | null> {
    return Chapter.findById(id).populate('storyId', 'title slug authorId moderationStatus')
  },

  async findByStoryAndSlug(
    storyId: string | Types.ObjectId,
    slug: string
  ): Promise<IChapter | null> {
    return Chapter.findOne({ storyId, ...chapterSlugFilter(slug) }).populate(
      'storyId',
      'title slug authorId moderationStatus chapterCount'
    )
  },

  async findByStoryAndOrder(
    storyId: string | Types.ObjectId,
    order: number
  ): Promise<IChapter | null> {
    return Chapter.findOne({ storyId, order })
  },

  async findPublishedChaptersByStoryId(
    storyId: string | Types.ObjectId
  ): Promise<IChapter[]> {
    return Chapter.find({ storyId, ...PUBLIC_CHAPTER_FILTER })
      .select('_id storyId title slug order status publishAt viewCount createdAt')
      .sort({ order: 1 })
      .lean() as unknown as IChapter[]
  },

  async findAllChaptersByStoryId(
    storyId: string | Types.ObjectId
  ): Promise<IChapter[]> {
    return Chapter.find({ storyId })
      .select('_id storyId title slug order status publishAt viewCount createdAt')
      .sort({ order: 1 })
      .lean() as unknown as IChapter[]
  },

  async getNextOrder(storyId: string | Types.ObjectId): Promise<number> {
    const lastChapter = await Chapter.findOne({ storyId }).sort({ order: -1 }).select('order')
    return lastChapter ? lastChapter.order + 1 : 1
  },

  async countPublishedByStoryId(storyId: string | Types.ObjectId): Promise<number> {
    return Chapter.countDocuments({ storyId, ...PUBLIC_CHAPTER_FILTER })
  },

  async countAllByStoryId(storyId: string | Types.ObjectId): Promise<number> {
    return Chapter.countDocuments({ storyId })
  },

  async create(data: CreateChapterInput): Promise<IChapter> {
    return mongoose.connection.transaction(async session => {
      const chapter = await new Chapter(data).save({ session })
      await recountChapterCount(chapter.storyId, session)
      return chapter
    })
  },

  async updateById(
    id: string | Types.ObjectId,
    data: UpdateChapterInput
  ): Promise<IChapter | null> {
    return mongoose.connection.transaction(async session => {
      const chapter = await Chapter.findByIdAndUpdate(id, { $set: data, $inc: { __v: 1 } }, { new: true, runValidators: true, session })
      if (chapter) await recountChapterCount(chapter.storyId, session)
      return chapter
    })
  },

  async deleteById(id: string | Types.ObjectId): Promise<IChapter | null> {
    return mongoose.connection.transaction(async session => {
      const chapter = await Chapter.findByIdAndDelete(id, { session })
      if (chapter) await recountChapterCount(chapter.storyId, session)
      return chapter
    })
  },

  async incrementViewCount(id: string | Types.ObjectId): Promise<void> {
    await Chapter.findByIdAndUpdate(id, { $inc: { viewCount: 1 } })
  },

  async findPrevChapter(
    storyId: string | Types.ObjectId,
    currentOrder: number
  ): Promise<IChapter | null> {
    return Chapter.findOne({
      storyId,
      ...PUBLIC_CHAPTER_FILTER,
      order: { $lt: currentOrder },
    })
      .sort({ order: -1 })
      .select('_id title slug order')
  },

  async findNextChapter(
    storyId: string | Types.ObjectId,
    currentOrder: number
  ): Promise<IChapter | null> {
    return Chapter.findOne({
      storyId,
      ...PUBLIC_CHAPTER_FILTER,
      order: { $gt: currentOrder },
    })
      .sort({ order: 1 })
      .select('_id title slug order')
  },

  async findScheduledDue(now: Date = new Date(), afterId?: string): Promise<IChapter[]> {
    return Chapter.aggregate<IChapter>([
      { $match: { status: 'scheduled', moderationStatus: 'approved', publishAt: { $lte: now },
        ...(afterId ? { _id: { $gt: new Types.ObjectId(afterId) } } : {}) } },
      { $sort: { _id: 1 } },
      { $lookup: { from: 'stories', localField: 'storyId', foreignField: '_id', as: 'parentStory',
        pipeline: [{ $match: { moderationStatus: 'approved' } }, { $project: { _id: 1 } }] } },
      { $match: { 'parentStory.0': { $exists: true } } },
      { $limit: 100 },
      { $unset: 'parentStory' },
    ]).option({ maxTimeMS: 5000 })
  },

  async claimScheduled(id: Types.ObjectId, now: Date): Promise<IChapter | null> {
    return mongoose.connection.transaction(async session => {
      const chapter = await Chapter.findOneAndUpdate({ _id: id, status: 'scheduled', moderationStatus: 'approved', publishAt: { $lte: now } },
        { $set: { status: 'published' }, $inc: { __v: 1 } }, { new: true, runValidators: true, session })
      if (chapter) await recountChapterCount(chapter.storyId, session)
      return chapter
    })
  },

  async reorderAfterDelete(
    storyId: string | Types.ObjectId,
    deletedOrder: number
  ): Promise<void> {
    await Chapter.updateMany(
      { storyId, order: { $gt: deletedOrder } },
      { $inc: { order: -1 } }
    )
  },

  async countPendingModeration(): Promise<number> {
    const removedStoryIds = await Story.distinct('_id', { moderationStatus: 'removed' })
    return Chapter.countDocuments({ moderationStatus: 'pending', storyId: { $nin: removedStoryIds } })
  },

  async findModerationQueue(options: {
    filter: FilterQuery<IChapter>
    sortDirection: 1 | -1
    limit: number
  }): Promise<IChapter[]> {
    const removedStoryIds = await Story.distinct('_id', { moderationStatus: 'removed' })
    return Chapter.find({ $and: [options.filter, { storyId: { $nin: removedStoryIds } }] })
      .sort({ createdAt: options.sortDirection, _id: options.sortDirection })
      .limit(options.limit + 1)
      .populate({
        path: 'storyId',
        select: 'title slug authorId coverUrl',
        populate: { path: 'authorId', select: 'displayName username avatarUrl' },
      })
  },

  async findByIdForModeration(id: string | Types.ObjectId): Promise<IChapter | null> {
    return Chapter.findById(id).populate({
      path: 'storyId',
      select: 'title slug authorId',
      populate: { path: 'authorId', select: 'displayName username email' },
    })
  },

  async findByIdWithStoryAuthor(id: string | Types.ObjectId): Promise<IChapter | null> {
    return Chapter.findById(id).populate('storyId', 'authorId')
  },

  async findByIdForReportTarget(id: string | Types.ObjectId): Promise<IChapter | null> {
    return Chapter.findById(id).populate({
      path: 'storyId',
      select: 'title slug authorId',
      populate: { path: 'authorId', select: 'displayName username' },
    })
  },

  async updateModerationStatus(
    id: string | Types.ObjectId,
    moderationStatus: 'pending' | 'approved' | 'hidden' | 'rejected'
  ): Promise<IChapter | null> {
    return Chapter.findByIdAndUpdate(id, { $set: { moderationStatus } }, { new: true })
  },
}
