import { ReadingHistory, IReadingHistory } from '../models/ReadingHistory.model.js'
import { Types } from 'mongoose'
import { personalCursorFilter } from '../common/personalPagination.js'

export const readingHistoryRepository = {
  async upsert(
    userId: string | Types.ObjectId,
    storyId: string | Types.ObjectId,
    lastChapterId: string | Types.ObjectId,
    scrollPositionPercent?: number
  ): Promise<IReadingHistory> {
    const chapterId = new Types.ObjectId(String(lastChapterId))
    return ReadingHistory.findOneAndUpdate(
      { userId, storyId },
      [{ $set: {
        lastChapterId: chapterId, lastReadAt: '$$NOW',
        createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
        scrollPositionPercent: typeof scrollPositionPercent === 'number'
          ? Math.min(Math.max(scrollPositionPercent, 0), 100)
          : { $cond: [{ $eq: ['$lastChapterId', chapterId] }, { $ifNull: ['$scrollPositionPercent', 0] }, 0] },
      } }],
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ) as Promise<IReadingHistory>
  },

  async findByUserId(
    userId: string | Types.ObjectId,
    limit: number = 20,
    cursor?: string,
  ): Promise<IReadingHistory[]> {
    return ReadingHistory.find({ userId, ...personalCursorFilter(cursor, 'lastReadAt') })
      .sort({ lastReadAt: -1, _id: -1 })
      .limit(limit)
      .populate({ path: 'storyId', select: 'title slug coverUrl chapterCount status authorId', match: { moderationStatus: 'approved' } })
      .populate({ path: 'lastChapterId', select: 'title slug order', match: { status: 'published', moderationStatus: 'approved' } })
      .lean() as unknown as IReadingHistory[]
  },

  async findOne(
    userId: string | Types.ObjectId,
    storyId: string | Types.ObjectId
  ): Promise<IReadingHistory | null> {
    return ReadingHistory.findOne({ userId, storyId })
      .populate({ path: 'lastChapterId', select: 'title slug order', match: { status: 'published', moderationStatus: 'approved' } })
  },
}
