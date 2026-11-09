import { Follow, IFollow } from '../models/Follow.model.js'
import mongoose, { Types } from 'mongoose'
import { Story } from '../models/Story.model.js'
import { AppError } from '../common/AppError.js'
import { personalCursorFilter } from '../common/personalPagination.js'

export const followRepository = {
  async change(userId: string, storyId: string, operation: 'toggle' | 'remove') {
    return mongoose.connection.transaction(async session => {
      const story = await Story.findByIdAndUpdate(storyId, { $inc: { __v: 1 } }, { session, new: true })
      if (!story || (operation === 'toggle' && story.moderationStatus === 'removed')) throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ', 'STORY_NOT_FOUND')
      const existing = await Follow.findOne({ userId, storyId }).session(session)
      const isFollowing = operation === 'toggle' && !existing
      if (isFollowing) {
        if (story.moderationStatus !== 'approved') throw AppError.notFound('Truyện không tồn tại', 'STORY_NOT_FOUND')
        await Follow.create([{ userId, storyId }], { session })
      } else if (existing) await Follow.deleteOne({ _id: existing._id }, { session })
      const followCount = await Follow.countDocuments({ storyId }).session(session)
      await Story.updateOne({ _id: storyId }, { $set: { followCount } }, { session })
      return { isFollowing, followCount, story }
    })
  },
  async create(
    userId: string | Types.ObjectId,
    storyId: string | Types.ObjectId
  ): Promise<IFollow> {
    return Follow.findOneAndUpdate(
      { userId, storyId },
      { $setOnInsert: { userId, storyId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ) as Promise<IFollow>
  },

  async delete(
    userId: string | Types.ObjectId,
    storyId: string | Types.ObjectId
  ): Promise<IFollow | null> {
    return Follow.findOneAndDelete({ userId, storyId })
  },

  async findOne(
    userId: string | Types.ObjectId,
    storyId: string | Types.ObjectId
  ): Promise<IFollow | null> {
    return Follow.findOne({ userId, storyId })
  },

  async findByUserId(
    userId: string | Types.ObjectId,
    limit: number = 50,
    cursor?: string,
  ): Promise<IFollow[]> {
    return Follow.find({ userId, ...personalCursorFilter(cursor, 'createdAt') })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate({
        path: 'storyId',
        match: { moderationStatus: 'approved' },
        select: 'title slug coverUrl authorId originalAuthor sourceName description chapterCount viewCount followCount ratingAverage status updatedAt',
        populate: {
          path: 'authorId',
          select: 'displayName username avatarUrl',
        },
      })
      .lean() as unknown as IFollow[]
  },

  async findFollowersByStoryId(
    storyId: string | Types.ObjectId,
    afterId?: string,
    limit = 200
  ): Promise<IFollow[]> {
    const sId = typeof storyId === 'string' ? new Types.ObjectId(storyId) : storyId
    return Follow.find({ storyId: sId, ...(afterId ? { _id: { $gt: new Types.ObjectId(afterId) } } : {}) })
      .sort({ _id: 1 }).limit(limit)
      .select('userId storyId')
      .lean() as unknown as IFollow[]
  },
}
