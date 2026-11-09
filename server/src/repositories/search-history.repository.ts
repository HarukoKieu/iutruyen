import { Types } from 'mongoose'
import { SearchHistory, ISearchHistory } from '../models/SearchHistory.model.js'

export const searchHistoryRepository = {
  async upsert(
    userId: string | Types.ObjectId,
    query: string
  ): Promise<ISearchHistory> {
    const trimmed = query.trim()
    const record = await SearchHistory.findOneAndUpdate(
      { userId, query: trimmed },
      { $set: { updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    // Keep max 20 search history items per user by pruning older ones
    const count = await SearchHistory.countDocuments({ userId })
    if (count > 20) {
      const itemsToKeep = await SearchHistory.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(20)
        .select('_id')
        .lean()

      const keepIds = itemsToKeep.map((item) => item._id)
      await SearchHistory.deleteMany({
        userId,
        _id: { $nin: keepIds },
      })
    }

    return record
  },

  async findByUserId(
    userId: string | Types.ObjectId,
    limit: number = 10
  ): Promise<ISearchHistory[]> {
    return SearchHistory.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean() as unknown as ISearchHistory[]
  },

  async deleteItem(
    userId: string | Types.ObjectId,
    query: string
  ): Promise<boolean> {
    const result = await SearchHistory.findOneAndDelete({
      userId,
      query: query.trim(),
    })
    return !!result
  },

  async clearAll(userId: string | Types.ObjectId): Promise<number> {
    const result = await SearchHistory.deleteMany({ userId })
    return result.deletedCount || 0
  },
}
