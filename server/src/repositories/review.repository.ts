import { Review, ReviewDocument, PopulatedReview } from '../models/Review.model.js'
import { Types } from 'mongoose'
import { encodeCursor, decodeCursor } from '../common/pagination.js'

export const reviewRepository = {
  async upsert(
    storyId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    content: string
  ): Promise<{ review: ReviewDocument; isNew: boolean }> {
    const existing = await Review.findOne({ storyId, userId })
    // Reuse the unique (story,user) identity even after soft deletion.
    const review = await Review.findOneAndUpdate({ storyId, userId }, {
      $set: { content, isDeleted: false },
      $setOnInsert: { likedUserIds: [], likeCount: 0 },
    }, { upsert: true, new: true, runValidators: true })
    return { review, isNew: !existing || existing.isDeleted }
  },

  async findById(id: string | Types.ObjectId): Promise<ReviewDocument | null> {
    return Review.findById(id)
  },

  async findByUser(
    storyId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<ReviewDocument | null> {
    return Review.findOne({ storyId, userId, isDeleted: false })
  },

  async findManyPaginated(
    storyId: string | Types.ObjectId,
    sort: 'newest' | 'top' = 'newest',
    cursor: string | null,
    limit: number = 10
  ): Promise<{
    items: PopulatedReview[]
    hasMore: boolean
    nextCursor: string | null
  }> {
    const filter: Record<string, unknown> = { storyId, isDeleted: false }

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

    const rawItems = await Review.find(filter)
      .sort(sortOption)
      .limit(limit + 1)
      .populate({
        path: 'userId',
        select: 'displayName username avatarUrl role authorStatus',
      })
      .lean()

    const items = rawItems as unknown as PopulatedReview[]
    const hasMore = items.length > limit
    if (hasMore) items.pop()

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

  async softDelete(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<ReviewDocument | null> {
    return Review.findOneAndUpdate(
      { _id: id, userId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    )
  },

  async toggleLike(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<ReviewDocument | null> {
    const userObjId = new Types.ObjectId(userId.toString())
    return Review.findOneAndUpdate({ _id: id, isDeleted: false }, [
      { $set: { likedUserIds: { $cond: [
        { $in: [userObjId, { $ifNull: ['$likedUserIds', []] }] },
        { $setDifference: ['$likedUserIds', [userObjId]] },
        { $setUnion: [{ $ifNull: ['$likedUserIds', []] }, [userObjId]] },
      ] } } },
      { $set: { likeCount: { $size: '$likedUserIds' } } },
    ], { new: true })
  },
}
