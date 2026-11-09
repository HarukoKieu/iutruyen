import { Rating, RatingDocument } from '../models/Rating.model.js'
import { storyRepository } from './story.repository.js'
import mongoose, { Types } from 'mongoose'
import { Story } from '../models/Story.model.js'
import { AppError } from '../common/AppError.js'

export const ratingRepository = {
  /**
   * Upsert a rating (1 per user per story).
   * After upsert, recalculates ratingAverage and ratingCount on the Story.
   */
  async upsert(
    storyId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    score: number
  ): Promise<RatingDocument> {
    return mongoose.connection.transaction(async session => {
      // Serialize ratings for one story using its existing aggregate document.
      const story = await Story.findOneAndUpdate({ _id: storyId, moderationStatus: 'approved' }, { $inc: { __v: 1 } }, { session })
      if (!story) throw AppError.notFound('Truyện không tồn tại')
      const rating = await Rating.findOneAndUpdate({ storyId, userId }, { score }, { session, upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true })
      const [stats] = await Rating.aggregate<{ average: number; count: number }>([
        { $match: { storyId: new Types.ObjectId(String(storyId)) } },
        { $group: { _id: null, average: { $avg: '$score' }, count: { $sum: 1 } } },
      ]).session(session)
      await Story.updateOne({ _id: storyId }, { $set: { ratingAverage: Math.round((stats?.average || 0) * 10) / 10, ratingCount: stats?.count || 0 } }, { session })
      return rating as RatingDocument
    })
  },

  async findByUser(
    storyId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<RatingDocument | null> {
    return Rating.findOne({ storyId, userId })
  },

  /**
   * Recalculate ratingAverage and ratingCount for a story.
   */
  async recalculateStoryRating(storyId: string | Types.ObjectId): Promise<void> {
    const agg = await Rating.aggregate<{ _id: Types.ObjectId; ratingAverage: number; ratingCount: number }>([
      { $match: { storyId: new Types.ObjectId(storyId.toString()) } },
      {
        $group: {
          _id: '$storyId',
          ratingAverage: { $avg: '$score' },
          ratingCount: { $sum: 1 },
        },
      },
    ])

    if (agg.length > 0) {
      const { ratingAverage, ratingCount } = agg[0]
      await storyRepository.updateRating(
        storyId,
        Math.round(ratingAverage * 10) / 10,
        ratingCount
      )
    } else {
      await storyRepository.updateRating(storyId, 0, 0)
    }
  },
}
