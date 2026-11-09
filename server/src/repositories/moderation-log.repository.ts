import {
  ModerationLog,
  IModerationLog,
  ModerationAction,
  ModerationTargetType,
} from '../models/ModerationLog.model.js'
import mongoose, { Types, FilterQuery, Document, Model } from 'mongoose'
import { AppError } from '../common/AppError.js'
import { syncModeratedCounters } from './content-counters.js'
import {
  decodeCursor,
  encodeCursor,
  buildCursorMeta,
  CursorPaginationMeta,
} from '../common/pagination.js'

export interface QueryModerationLogsOptions {
  action?: string
  targetType?: ModerationTargetType
  moderatorId?: string
  cursor?: string | null
  limit?: number
  fromDate?: Date
  toDate?: Date
}

export interface QueryModerationLogsResult {
  logs: IModerationLog[]
  meta: CursorPaginationMeta
}

export const moderationLogRepository = {
  /** Commit the decision and its audit record together; reject stale moderator screens. */
  async saveWithLog(document: Document, data: {
    moderatorId: Types.ObjectId | string; action: string; targetType: ModerationTargetType
    targetId: Types.ObjectId | string; targetTitle?: string; reason?: string; note?: string
  }): Promise<void> {
    const Entity = document.constructor as Model<Document>
    const expectedDate: unknown = document.get('updatedAt')
    const changes = document.getChanges()
    await mongoose.connection.transaction(async session => {
      const result = await Entity.updateOne({ _id: document._id, updatedAt: expectedDate, __v: document.get('__v') }, { ...changes, $inc: { __v: 1 } }, { session, runValidators: true })
      if (result.matchedCount !== 1) throw AppError.conflict('Nội dung đã thay đổi, vui lòng tải lại trước khi duyệt', 'STALE_MODERATION')
      await syncModeratedCounters(document, session)
      await ModerationLog.create([{ ...data }], { session })
    })
  },
  async log(data: {
    moderatorId: Types.ObjectId | string
    action: ModerationAction | string
    targetType: ModerationTargetType
    targetId: Types.ObjectId | string
    targetTitle?: string
    reason?: string
    note?: string
    metadata?: Record<string, any>
  }): Promise<IModerationLog> {
    return ModerationLog.create({
      ...data,
      moderatorId: new Types.ObjectId(data.moderatorId),
      targetId: new Types.ObjectId(data.targetId),
      createdAt: new Date(),
    })
  },

  async findWithCursor(options: QueryModerationLogsOptions): Promise<QueryModerationLogsResult> {
    const { action, targetType, moderatorId, cursor, limit = 20, fromDate, toDate } = options

    const filter: FilterQuery<IModerationLog> = {}

    if (action) {
      filter.action = action
    }
    if (targetType) {
      filter.targetType = targetType
    }
    if (moderatorId && Types.ObjectId.isValid(moderatorId)) {
      filter.moderatorId = new Types.ObjectId(moderatorId)
    }
    if (fromDate || toDate) {
      filter.createdAt = {}
      if (fromDate) filter.createdAt.$gte = fromDate
      if (toDate) filter.createdAt.$lte = toDate
    }

    if (cursor) {
      const decoded = decodeCursor<{ createdAt: string; _id: string }>(cursor)
      if (decoded && decoded._id) {
        const cursorDate = new Date(decoded.createdAt)
        const cursorId = new Types.ObjectId(decoded._id)

        filter.$or = [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } },
        ]
      }
    }

    const items = await ModerationLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('moderatorId', 'displayName username avatarUrl role')

    const hasMore = items.length > limit
    const logs = hasMore ? items.slice(0, limit) : items

    let nextCursor: string | null = null
    if (hasMore && logs.length > 0) {
      const last = logs[logs.length - 1]
      nextCursor = encodeCursor({
        createdAt: last.createdAt.toISOString(),
        _id: last._id.toString(),
      })
    }

    return {
      logs,
      meta: buildCursorMeta(limit, nextCursor, hasMore),
    }
  },

  async findByTarget(
    targetType: ModerationTargetType,
    targetId: Types.ObjectId | string,
    limit: number = 20
  ): Promise<IModerationLog[]> {
    if (!Types.ObjectId.isValid(targetId)) return []
    return ModerationLog.find({ targetType, targetId: new Types.ObjectId(targetId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('moderatorId', 'displayName username')
  },
}
