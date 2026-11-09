import { Bookmark, IBookmark } from '../models/Bookmark.model.js'
import { Types } from 'mongoose'
import { personalCursorFilter } from '../common/personalPagination.js'

export const bookmarkRepository = {
  async create(
    userId: string | Types.ObjectId,
    chapterId: string | Types.ObjectId,
    note?: string
  ): Promise<IBookmark> {
    return Bookmark.findOneAndUpdate(
      { userId, chapterId },
      { $set: { note } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ) as Promise<IBookmark>
  },

  async findByUserId(
    userId: string | Types.ObjectId,
    limit: number = 50,
    cursor?: string,
  ): Promise<IBookmark[]> {
    return Bookmark.find({ userId, ...personalCursorFilter(cursor, 'createdAt') })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate({
        path: 'chapterId',
        match: { status: 'published', moderationStatus: 'approved' },
        select: 'title slug order storyId',
        populate: {
          path: 'storyId',
          match: { moderationStatus: 'approved' },
          select: 'title slug coverUrl',
        },
      })
      .lean() as unknown as IBookmark[]
  },

  async findOne(
    userId: string | Types.ObjectId,
    chapterId: string | Types.ObjectId
  ): Promise<IBookmark | null> {
    return Bookmark.findOne({ userId, chapterId })
  },

  async deleteById(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IBookmark | null> {
    return Bookmark.findOneAndDelete({ _id: id, userId })
  },

  async deleteByChapter(
    userId: string | Types.ObjectId,
    chapterId: string | Types.ObjectId
  ): Promise<IBookmark | null> {
    return Bookmark.findOneAndDelete({ userId, chapterId })
  },
}
