import mongoose, { Types } from 'mongoose'
import { BackupJob } from '../models/BackupJob.model.js'
import { AuditLog } from '../models/AuditLog.model.js'
import { ensureGuard, requireActor } from './admin.repository.js'
import { AppError } from '../common/AppError.js'
import { decodeCursor, encodeCursor } from '../common/pagination.js'

const budget = 5000
type Row = { _id: unknown; actorId: unknown; status: string; consistency?: string | null; createdAt: Date; startedAt?: Date | null; finishedAt?: Date | null; sizeBytes?: number | null; sha256?: string | null; errorCode?: string | null }
export const backupDto = (r: Row) => ({ id: String(r._id), actorId: String(r.actorId), status: r.status, consistency: r.consistency, createdAt: r.createdAt, startedAt: r.startedAt, finishedAt: r.finishedAt, sizeBytes: r.sizeBytes, sha256: r.sha256, errorCode: r.errorCode })
export const backupRepository = {
  async enqueue(actorId: string, actorVersion: number, reason: string, requestId: string) {
    await ensureGuard()
    const session = await mongoose.startSession()
    try { return await session.withTransaction(async () => {
      const actor = await requireActor(actorId, session)
      if ((actor.authVersion ?? 0) !== actorVersion) throw AppError.forbidden('Phiên admin đã thay đổi', 'ADMIN_PERMISSION_CHANGED')
      if (await BackupJob.exists({ active: true }).session(session)) throw AppError.conflict('Đã có backup trong hàng đợi hoặc đang chạy', 'BACKUP_BUSY')
      const [job] = await BackupJob.create([{ actorId, reason, requestId }], { session })
      const dto = backupDto(job)
      await AuditLog.create([{ actorId, actorRole: 'admin', action: 'backup', targetType: 'backup', targetId: String(job._id), before: {}, after: dto, reason, requestId }], { session })
      return dto
    }, { maxCommitTimeMS: budget, timeoutMS: 15000 }) } catch (error) {
      if ((error as { code?: number }).code === 11000) throw AppError.conflict('Đã có backup đang hoạt động', 'BACKUP_BUSY')
      throw error
    } finally { await session.endSession() }
  },
  async list(query: { cursor?: string; limit: number }) {
    const cursor = decodeCursor(query.cursor)
    if (query.cursor && (!cursor || cursor.key !== 'backup-v1' || typeof cursor.id !== 'string' || !/^[a-f\d]{24}$/.test(cursor.id) || typeof cursor.date !== 'string' || !Number.isFinite(Date.parse(cursor.date)))) throw AppError.badRequest('Cursor backup không hợp lệ', 'INVALID_CURSOR')
    const filter = cursor ? { $or: [{ createdAt: { $lt: new Date(cursor.date as string) } }, { createdAt: new Date(cursor.date as string), _id: { $lt: new Types.ObjectId(cursor.id as string) } }] } : {}
    const rows = await BackupJob.find(filter).select('_id actorId status consistency createdAt startedAt finishedAt sizeBytes sha256 errorCode').sort({ createdAt: -1, _id: -1 }).limit(query.limit + 1).maxTimeMS(budget).lean()
    const last = rows[Math.min(rows.length, query.limit) - 1], hasMore = rows.length > query.limit
    return { items: rows.slice(0, query.limit).map(backupDto), meta: { limit: query.limit, hasMore, nextCursor: hasMore && last ? encodeCursor({ key: 'backup-v1', id: String(last._id), date: last.createdAt.toISOString() }) : null } }
  },
  recover: () => BackupJob.updateMany({ status: 'running', active: true, leaseUntil: { $lt: new Date() } }, { $set: { status: 'failed', active: false, finishedAt: new Date(), errorCode: 'WORKER_INTERRUPTED' }, $unset: { leaseOwner: '', leaseUntil: '' } }, { maxTimeMS: budget }),
  claim: (owner: string) => BackupJob.findOneAndUpdate({ status: 'queued', active: true }, { $set: { status: 'running', leaseOwner: owner, leaseUntil: new Date(Date.now() + 60000), startedAt: new Date() } }, { new: true, sort: { createdAt: 1 }, maxTimeMS: budget }).lean(),
  async heartbeat(id: string, owner: string) { const result = await BackupJob.updateOne({ _id: id, status: 'running', leaseOwner: owner, leaseUntil: { $gt: new Date() } }, { $set: { leaseUntil: new Date(Date.now() + 60000) } }, { maxTimeMS: budget }); return result.modifiedCount === 1 },
  async finish(id: string, owner: string, result: { artifactKey: string; sizeBytes: number; sha256: string } | { errorCode: string }) {
    const update = await BackupJob.updateOne({ _id: id, status: 'running', leaseOwner: owner, leaseUntil: { $gt: new Date() } }, { $set: { ...result, status: 'errorCode' in result ? 'failed' : 'succeeded', active: false, finishedAt: new Date() }, $unset: { leaseOwner: '', leaseUntil: '' } }, { maxTimeMS: budget })
    return update.modifiedCount === 1
  },
}
