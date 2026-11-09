import { Comment, CommentDocument, PopulatedComment } from '../models/Comment.model.js'
import mongoose, { Types, FilterQuery } from 'mongoose'
import { encodeCursor, decodeCursor } from '../common/pagination.js'
import { recountReplyCount } from './content-counters.js'
import { AppError } from '../common/AppError.js'

interface FindCommentsOptions {
  storyId: string | Types.ObjectId
  chapterId?: string | Types.ObjectId | null
  sort?: 'newest' | 'top'
  cursor?: string | null
  limit?: number
}

interface FindRepliesOptions {
  parentId: string | Types.ObjectId
  cursor?: string | null
  limit?: number
}

export const commentRepository = {
  async create(data: {
    storyId: string | Types.ObjectId
    chapterId?: string | Types.ObjectId | null
    userId: string | Types.ObjectId
    parentId?: string | Types.ObjectId | null
    replyToUserId?: string | Types.ObjectId | null
    content: string
    spamScore?: number
  }): Promise<CommentDocument> {
    const comment = new Comment({
      storyId: data.storyId,
      chapterId: data.chapterId ?? null,
      userId: data.userId,
      parentId: data.parentId ?? null,
      replyToUserId: data.replyToUserId ?? null,
      content: data.content,
      spamScore: data.spamScore ?? 0,
    })
    if (!data.parentId) return comment.save()
    return mongoose.connection.transaction(async session => {
      const parent = await Comment.updateOne({ _id: data.parentId, parentId: null, storyId: data.storyId,
        chapterId: data.chapterId ?? null, isDeleted: false, isHidden: { $ne: true }, isLocked: false,
      }, { $inc: { __v: 1 } }, { session })
      if (parent.matchedCount !== 1) throw AppError.conflict('Bình luận gốc đã thay đổi hoặc bị khóa', 'COMMENT_UNAVAILABLE')
      const saved = await comment.save({ session })
      await recountReplyCount(data.parentId, session)
      return saved
    })
  },

  async findById(id: string | Types.ObjectId): Promise<CommentDocument | null> {
    return Comment.findById(id)
  },

  async findPopulatedById(id: string | Types.ObjectId): Promise<PopulatedComment | null> {
    return Comment.findById(id)
      .populate({ path: 'userId', select: 'displayName username avatarUrl role authorStatus' })
      .populate({ path: 'replyToUserId', select: 'displayName username' })
      .lean() as unknown as Promise<PopulatedComment | null>
  },

  async findManyPaginated(options: FindCommentsOptions): Promise<{
    items: PopulatedComment[]
    hasMore: boolean
    nextCursor: string | null
  }> {
    const { storyId, chapterId, sort = 'newest', cursor, limit = 20 } = options

    const filter: FilterQuery<CommentDocument> = {
      storyId,
      parentId: null, // Only fetch root comments
      isDeleted: false,
      isHidden: { $ne: true },
    }
    // null/undefined means story-level; specific ObjectId means chapter-level
    filter.chapterId = chapterId || null

    // Apply cursor
    const decoded = decodeCursor<{ createdAt?: string; likeCount?: number; _id?: string }>(cursor)

    if (decoded) {
      if (sort === 'newest' && decoded.createdAt && decoded._id) {
        filter.$or = [
          { createdAt: { $lt: new Date(decoded.createdAt) } },
          { createdAt: new Date(decoded.createdAt), _id: { $lt: new Types.ObjectId(decoded._id) } },
        ]
      } else if (sort === 'top' && decoded.likeCount !== undefined && decoded._id) {
        filter.$or = [
          { likeCount: { $lt: decoded.likeCount } },
          { likeCount: decoded.likeCount, _id: { $lt: new Types.ObjectId(decoded._id) } },
        ]
      }
    }

    const sortOption: Record<string, 1 | -1> =
      sort === 'top' ? { likeCount: -1, _id: -1 } : { createdAt: -1, _id: -1 }

    const rawItems = await Comment.find(filter)
      .sort(sortOption)
      .limit(limit + 1)
      .populate({
        path: 'userId',
        select: 'displayName username avatarUrl role authorStatus',
      })
      .lean()

    const items = rawItems as unknown as PopulatedComment[]
    const hasMore = items.length > limit
    if (hasMore) items.pop()

    // Fetch initial 2 preview replies for each root comment
    const commentIds = items.map((c) => c._id)
    if (commentIds.length > 0) {
      // Bounded two-row queries, at most four in flight. Never materialize all replies.
      for (let offset = 0; offset < items.length; offset += 4) {
        await Promise.all(items.slice(offset, offset + 4).map(async item => {
          item.previewReplies = await Comment.find({ parentId: item._id, isDeleted: false, isHidden: { $ne: true } })
            .sort({ createdAt: 1, _id: 1 }).limit(2)
            .populate({ path: 'userId', select: 'displayName username avatarUrl role authorStatus' })
            .populate({ path: 'replyToUserId', select: 'displayName username' })
            .lean() as unknown as PopulatedComment[]
        }))
      }
    }

    let nextCursor: string | null = null
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]
      nextCursor =
        sort === 'top'
          ? encodeCursor({ likeCount: last.likeCount, _id: String(last._id) })
          : encodeCursor({ createdAt: (last.createdAt as Date).toISOString(), _id: String(last._id) })
    }

    return { items, hasMore, nextCursor }
  },

  async findRepliesPaginated(options: FindRepliesOptions): Promise<{
    items: PopulatedComment[]
    hasMore: boolean
    nextCursor: string | null
  }> {
    const { parentId, cursor, limit = 10 } = options

    const filter: FilterQuery<CommentDocument> = {
      parentId,
      isDeleted: false,
      isHidden: { $ne: true },
    }

    const decoded = decodeCursor<{ createdAt?: string; _id?: string }>(cursor)
    if (decoded && decoded.createdAt && decoded._id) {
      filter.$or = [
        { createdAt: { $gt: new Date(decoded.createdAt) } },
        { createdAt: new Date(decoded.createdAt), _id: { $gt: new Types.ObjectId(decoded._id) } },
      ]
    }

    const rawItems = await Comment.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .limit(limit + 1)
      .populate({
        path: 'userId',
        select: 'displayName username avatarUrl role authorStatus',
      })
      .populate({
        path: 'replyToUserId',
        select: 'displayName username',
      })
      .lean()

    const items = rawItems as unknown as PopulatedComment[]
    const hasMore = items.length > limit
    if (hasMore) items.pop()

    let nextCursor: string | null = null
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]
      nextCursor = encodeCursor({
        createdAt: (last.createdAt as Date).toISOString(),
        _id: String(last._id),
      })
    }

    return { items, hasMore, nextCursor }
  },

  async update(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    content: string
  ): Promise<CommentDocument | null> {
    return Comment.findOneAndUpdate(
      { _id: id, userId, isDeleted: false, isHidden: { $ne: true } },
      { content },
      { new: true }
    )
  },

  async softDelete(
    id: string | Types.ObjectId,
    _deletedBy: string | Types.ObjectId
  ): Promise<CommentDocument | null> {
    return mongoose.connection.transaction(async session => {
      const comment = await Comment.findOneAndUpdate({ _id: id, isDeleted: false },
        { $set: { isDeleted: true, content: '[Bình luận đã bị xóa]' }, $inc: { __v: 1 } }, { new: true, session })
      if (comment?.parentId) await recountReplyCount(comment.parentId, session)
      return comment
    })
  },

  async toggleLock(id: string | Types.ObjectId): Promise<CommentDocument | null> {
    const comment = await Comment.findById(id)
    if (!comment) return null
    comment.isLocked = !comment.isLocked
    return comment.save()
  },

  async toggleLike(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<CommentDocument | null> {
    const userObjId = new Types.ObjectId(userId.toString())
    return Comment.findOneAndUpdate({ _id: id, isDeleted: false, isHidden: { $ne: true } }, [
      { $set: { likedUserIds: { $cond: [
        { $in: [userObjId, { $ifNull: ['$likedUserIds', []] }] },
        { $setDifference: ['$likedUserIds', [userObjId]] },
        { $setUnion: [{ $ifNull: ['$likedUserIds', []] }, [userObjId]] },
      ] } } },
      { $set: { likeCount: { $size: '$likedUserIds' }, __v: { $add: [{ $ifNull: ['$__v', 0] }, 1] } } },
    ], { new: true })
  },

  async countByStory(storyId: string | Types.ObjectId): Promise<number> {
    return Comment.countDocuments({ storyId, chapterId: null, parentId: null, isDeleted: false, isHidden: { $ne: true } })
  },

  async countByChapter(chapterId: string | Types.ObjectId): Promise<number> {
    return Comment.countDocuments({ chapterId, parentId: null, isDeleted: false, isHidden: { $ne: true } })
  },

  async countSpamQueue(): Promise<number> {
    return Comment.countDocuments({
      $or: [{ spamScore: { $gt: 0 } }, { isLocked: true }, { isHidden: true }],
      isDeleted: false,
    })
  },

  async findSpamQueue(options: {
    filter: FilterQuery<CommentDocument>
    sortDirection: 1 | -1
    limit: number
  }): Promise<CommentDocument[]> {
    return Comment.find(options.filter)
      .sort({ createdAt: options.sortDirection, _id: options.sortDirection })
      .limit(options.limit + 1)
      .populate('userId', 'displayName username avatarUrl role')
      .populate('storyId', 'title slug')
      .populate('chapterId', 'title slug order')
  },

  async findByIdForModeration(id: string | Types.ObjectId): Promise<CommentDocument | null> {
    return Comment.findById(id).populate('userId', 'displayName username')
  },

  async findByIdForReportTarget(id: string | Types.ObjectId): Promise<CommentDocument | null> {
    return Comment.findById(id)
      .populate('userId', 'displayName username avatarUrl role')
      .populate('storyId', 'title slug')
      .populate('chapterId', 'title slug order')
  },

  async updateSpamAndLock(
    id: string | Types.ObjectId,
    spamScore: number,
    isLocked: boolean
  ): Promise<CommentDocument | null> {
    return Comment.findByIdAndUpdate(id, { $set: { spamScore, isLocked } }, { new: true })
  },
}
