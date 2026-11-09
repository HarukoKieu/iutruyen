import { Report, IReport, ReportStatus, ReportTargetType } from '../models/Report.model.js'
import mongoose, { Types, FilterQuery, Document, Model } from 'mongoose'
import { ModerationLog } from '../models/ModerationLog.model.js'
import { AppError } from '../common/AppError.js'
import { syncModeratedCounters } from './content-counters.js'
import {
  decodeCursor,
  encodeCursor,
  buildCursorMeta,
  CursorPaginationMeta,
} from '../common/pagination.js'

export interface QueryReportsOptions {
  status?: ReportStatus
  targetType?: ReportTargetType
  assignedTo?: string
  cursor?: string | null
  limit?: number
}

export interface QueryReportsResult {
  reports: IReport[]
  meta: CursorPaginationMeta
}

export const reportRepository = {
  async create(data: {
    reporterId: Types.ObjectId | string
    targetType: ReportTargetType
    targetId: Types.ObjectId | string
    reason: string
    description?: string
    evidenceUrls?: string[]
  }): Promise<IReport> {
    return Report.create({
      ...data,
      status: 'pending',
    })
  },

  async findById(id: string | Types.ObjectId): Promise<IReport | null> {
    if (!Types.ObjectId.isValid(id)) return null
    return Report.findById(id)
      .populate('reporterId', 'displayName username avatarUrl role')
      .populate('assignedTo', 'displayName username avatarUrl role')
      .populate('notes.moderatorId', 'displayName username avatarUrl')
      .populate('resolution.moderatorId', 'displayName username avatarUrl')
  },

  async findWithCursor(options: QueryReportsOptions): Promise<QueryReportsResult> {
    const { status, targetType, assignedTo, cursor, limit = 20 } = options

    const filter: FilterQuery<IReport> = {}

    if (status) {
      filter.status = status
    }
    if (targetType) {
      filter.targetType = targetType
    }
    if (assignedTo && Types.ObjectId.isValid(assignedTo)) {
      filter.assignedTo = new Types.ObjectId(assignedTo)
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

    const items = await Report.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('reporterId', 'displayName username avatarUrl')
      .populate('assignedTo', 'displayName username avatarUrl')

    const hasMore = items.length > limit
    const reports = hasMore ? items.slice(0, limit) : items

    let nextCursor: string | null = null
    if (hasMore && reports.length > 0) {
      const last = reports[reports.length - 1]
      nextCursor = encodeCursor({
        createdAt: last.createdAt.toISOString(),
        _id: last._id.toString(),
      })
    }

    return {
      reports,
      meta: buildCursorMeta(limit, nextCursor, hasMore),
    }
  },

  async countPending(): Promise<number> {
    return Report.countDocuments({ status: { $in: ['pending', 'in_progress'] } })
  },

  async countByStatus(): Promise<Record<string, number>> {
    const counts = await Report.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    const res: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      resolved: 0,
      dismissed: 0,
    }
    for (const c of counts) {
      if (c._id) res[c._id] = c.count
    }
    return res
  },

  async findByTarget(targetType: ReportTargetType, targetId: Types.ObjectId | string): Promise<IReport[]> {
    if (!Types.ObjectId.isValid(targetId)) return []
    return Report.find({ targetType, targetId: new Types.ObjectId(targetId) })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('reporterId', 'displayName username')
  },

  async countByTarget(targetType: ReportTargetType, targetId: Types.ObjectId | string): Promise<number> {
    if (!Types.ObjectId.isValid(targetId)) return 0
    return Report.countDocuments({ targetType, targetId: new Types.ObjectId(targetId) })
  },

  async countByReporter(reporterId: Types.ObjectId | string): Promise<number> {
    if (!Types.ObjectId.isValid(reporterId)) return 0
    return Report.countDocuments({ reporterId: new Types.ObjectId(reporterId) })
  },

  async resolveReport(id: string | Types.ObjectId, resolution: { action: string; moderatorId: Types.ObjectId | string; note?: string }, target?: Document): Promise<IReport | null> {
    return mongoose.connection.transaction(async session => {
      if (target) {
        const Entity = target.constructor as Model<Document>
        const changed = await Entity.updateOne({ _id: target._id, updatedAt: target.get('updatedAt'), __v: target.get('__v') }, { ...target.getChanges(), $inc: { __v: 1 } }, { session, runValidators: true })
        if (changed.matchedCount !== 1) throw AppError.conflict('Nội dung đã thay đổi, vui lòng tải lại', 'STALE_MODERATION')
        await syncModeratedCounters(target, session)
      }
      const report = await Report.findOneAndUpdate({ _id: id, status: { $in: ['pending', 'in_progress'] } }, {
        $set: { status: resolution.action === 'dismiss' ? 'dismissed' : 'resolved', resolution: { ...resolution, moderatorId: new Types.ObjectId(resolution.moderatorId), resolvedAt: new Date() } },
      }, { session, new: true, runValidators: true })
      if (!report) throw AppError.conflict('Báo cáo đã được xử lý hoặc không còn tồn tại', 'REPORT_ALREADY_RESOLVED')
      await ModerationLog.create([{ moderatorId: resolution.moderatorId, action: resolution.action === 'dismiss' ? 'dismiss_report' : 'resolve_report', targetType: 'report', targetId: report._id, reason: report.reason, note: resolution.note, metadata: { action: resolution.action } }], { session })
      return report
    })
  },

  async assignReport(id: string | Types.ObjectId, moderatorId: string | Types.ObjectId, actorId: string | Types.ObjectId = moderatorId): Promise<IReport | null> {
    return mongoose.connection.transaction(async session => {
      const report = await Report.findOneAndUpdate({ _id: id, status: { $in: ['pending', 'in_progress'] } },
        { $set: { assignedTo: new Types.ObjectId(moderatorId), status: 'in_progress' } }, { session, new: true, runValidators: true })
      if (!report) throw AppError.conflict('Báo cáo không còn mở hoặc không tồn tại', 'REPORT_NOT_OPEN')
      await ModerationLog.create([{ moderatorId: actorId, action: 'assign_report', targetType: 'report', targetId: report._id, metadata: { assignedTo: String(moderatorId) } }], { session })
      return report
    })
  },

  async addNote(id: string | Types.ObjectId, moderatorId: string | Types.ObjectId, note: string): Promise<IReport | null> {
    return mongoose.connection.transaction(async session => {
      const report = await Report.findByIdAndUpdate(id, { $push: { notes: { moderatorId: new Types.ObjectId(moderatorId), note, createdAt: new Date() } } }, { session, new: true, runValidators: true })
      if (!report) return null
      await ModerationLog.create([{ moderatorId, action: 'add_report_note', targetType: 'report', targetId: report._id, note }], { session })
      return report
    })
  },
}
