import mongoose, { Types, type FilterQuery } from 'mongoose'
import { createHash } from 'node:crypto'
import { User, type IUser } from '../models/User.model.js'
import { Story } from '../models/Story.model.js'
import { Chapter } from '../models/Chapter.model.js'
import { Report } from '../models/Report.model.js'
import { AuditLog } from '../models/AuditLog.model.js'
import { AdminControl } from '../models/AdminControl.model.js'
import { SiteConfig } from '../models/SiteConfig.model.js'
import { AdminMetricSnapshot } from '../models/AdminMetricSnapshot.model.js'
import { AppError } from '../common/AppError.js'
import { isAccountLocked } from '../common/accountState.js'
import { encodeCursor, decodeCursor } from '../common/pagination.js'
import { adminUserDto, planAccountMutation } from '../modules/admin/admin.policy.js'
import type { Action, ActionPayload, UsersQuery, StoriesQuery, AuditQuery, ChartsQuery, ConfigInput } from '../modules/admin/admin.validation.js'

const MAX_TIME_MS = 5000
const USER_FIELDS = '_id email username displayName provider role authorStatus isEmailVerified isLocked lockedReason lockKind suspendedUntil adminVersion authVersion createdAt'
const defaultConfig = { siteName: 'iutruyen', description: '', announcement: '', version: 0 }
const activeFilter = (now = new Date()): FilterQuery<IUser> => ({ $or: [{ isLocked: { $ne: true } }, { isLocked: true, lockKind: 'suspend', suspendedUntil: { $type: 'date', $lte: now } }] })
const prefix = (value: string) => new RegExp('^' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
const fingerprint = (scope: string, filters: object) => createHash('sha256').update(JSON.stringify([scope, filters])).digest('hex')
function pageFilter(scope: string, query: { cursor?: string; limit: number }, filters: object) {
  const key = fingerprint(scope, filters)
  const cursor = decodeCursor(query.cursor)
  if (query.cursor && (!cursor || cursor.key !== key || typeof cursor.id !== 'string' || !/^[a-f\d]{24}$/i.test(cursor.id) || typeof cursor.date !== 'string' || !Number.isFinite(Date.parse(cursor.date)))) throw AppError.badRequest('Cursor không hợp lệ cho bộ lọc này', 'INVALID_CURSOR')
  const where = cursor ? { $and: [filters, { $or: [{ createdAt: { $lt: new Date(cursor.date as string) } }, { createdAt: new Date(cursor.date as string), _id: { $lt: new Types.ObjectId(cursor.id as string) } }] }] } : filters
  return { key, where }
}
function pageMeta(rows: { _id: { toString(): string }; createdAt: Date }[], limit: number, key: string) {
  const hasMore = rows.length > limit
  const last = rows[Math.min(rows.length, limit) - 1]
  return { limit, hasMore, nextCursor: hasMore && last ? encodeCursor({ key, id: last._id.toString(), date: last.createdAt.toISOString() }) : null }
}
export async function ensureGuard() {
  try { await AdminControl.updateOne({ _id: 'global' }, { $setOnInsert: { revision: 0 } }, { upsert: true, maxTimeMS: MAX_TIME_MS }) }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error }
}
export async function requireActor(actorId: string, session: mongoose.ClientSession) {
  await AdminControl.updateOne({ _id: 'global' }, { $inc: { revision: 1 } }, { session })
  const actor = await User.findById(actorId).select(USER_FIELDS).session(session).lean()
  if (!actor || actor.role !== 'admin' || isAccountLocked(actor)) throw AppError.forbidden('Quyền admin đã thay đổi', 'ADMIN_PERMISSION_CHANGED')
  return actor
}
const configDto = (config: { siteName: string; description?: string | null; announcement?: string | null; version?: number | null } | null) => config ? { siteName: config.siteName, description: config.description ?? '', announcement: config.announcement ?? '', version: config.version ?? 0 } : defaultConfig

/** Bounded private reads and atomic admin mutations; DB remains the authorization authority. */
export const adminRepository = {
  findIdentity: (id: string) => User.findById(id).select(USER_FIELDS + ' password').maxTimeMS(MAX_TIME_MS).lean(),
  async user(id: string) {
    const row = await User.findById(id).select(USER_FIELDS).maxTimeMS(MAX_TIME_MS).lean()
    if (!row) throw AppError.notFound('Không tìm thấy tài khoản', 'USER_NOT_FOUND')
    return adminUserDto(row)
  },
  async users(query: UsersQuery) {
    const filters: FilterQuery<IUser> = {}
    if (query.role) filters.role = query.role
    if (query.authorStatus) filters.authorStatus = query.authorStatus
    if (query.status === 'active') Object.assign(filters, activeFilter())
    if (query.status === 'locked') filters.$nor = [activeFilter()]
    if (query.q) filters.$and = [{ $or: [{ username: prefix(query.q) }, { email: prefix(query.q) }] }]
    // Bind semantic filters, not the moving suspension deadline, to the cursor.
    const key = fingerprint('users', { role: query.role, authorStatus: query.authorStatus, status: query.status, q: query.q })
    const parsed = pageFilter('users', query, { role: query.role, authorStatus: query.authorStatus, status: query.status, q: query.q })
    const cursorCondition = query.cursor ? (parsed.where as { $and: object[] }).$and[1] : {}
    const rows = await User.find({ $and: [filters, cursorCondition] }).select(USER_FIELDS).sort({ createdAt: -1, _id: -1 }).limit(query.limit + 1).maxTimeMS(MAX_TIME_MS).lean()
    return { items: rows.slice(0, query.limit).map(adminUserDto), meta: pageMeta(rows, query.limit, key) }
  },
  async stories(query: StoriesQuery) {
    const filters = { ...(query.moderationStatus ? { moderationStatus: query.moderationStatus } : {}), ...(query.q ? { title: prefix(query.q) } : {}) }
    // JSON serializes RegExp as {}; bind the raw search string as well.
    const parsed = pageFilter('stories', query, { moderationStatus: query.moderationStatus, q: query.q })
    const condition = query.cursor ? (parsed.where as { $and: object[] }).$and[1] : {}
    const rows = await Story.find({ $and: [filters, condition] }).select('_id title slug authorId moderationStatus status contentWarning viewCount chapterCount createdAt').sort({ createdAt: -1, _id: -1 }).limit(query.limit + 1).maxTimeMS(MAX_TIME_MS).lean()
    return { items: rows.slice(0, query.limit).map(({ _id, ...row }) => ({ id: String(_id), ...row })), meta: pageMeta(rows, query.limit, parsed.key) }
  },
  async audit(query: AuditQuery) {
    const filters = { ...(query.actorId ? { actorId: new Types.ObjectId(query.actorId) } : {}), ...(query.targetId ? { targetId: query.targetId } : {}), ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to ? { createdAt: { ...(query.from ? { $gte: new Date(query.from) } : {}), ...(query.to ? { $lt: new Date(Date.parse(query.to) + 86400000) } : {}) } } : {}) }
    const parsed = pageFilter('audit', query, filters)
    const rows = await AuditLog.find(parsed.where).select('_id actorId actorRole action targetType targetId before after reason requestId createdAt').sort({ createdAt: -1, _id: -1 }).limit(query.limit + 1).maxTimeMS(MAX_TIME_MS).lean()
    return { items: rows.slice(0, query.limit), meta: pageMeta(rows, query.limit, parsed.key) }
  },
  async mutateUser(actorId: string, targetId: string, action: Action, input: ActionPayload, requestId: string, actorVersion: number) {
    await ensureGuard()
    const session = await mongoose.startSession()
    try { return await session.withTransaction(async () => {
      const actor = await requireActor(actorId, session)
      if ((actor.authVersion ?? 0) !== actorVersion) throw AppError.forbidden('Phiên admin đã thay đổi', 'ADMIN_PERMISSION_CHANGED')
      const target = await User.findById(targetId).select(USER_FIELDS).session(session).lean()
      if (!target) throw AppError.notFound('Không tìm thấy tài khoản', 'USER_NOT_FOUND')
      const { patch, reducesAdmin } = planAccountMutation(actorId, target, action, input)
      if (reducesAdmin && await User.countDocuments({ role: 'admin', ...activeFilter() }).session(session) <= 1) throw AppError.conflict('Phải giữ ít nhất một admin hoạt động', 'LAST_ADMIN')
      const updated = await User.findOneAndUpdate({ _id: targetId }, { $set: patch }, { new: true, session, runValidators: true }).select(USER_FIELDS).lean()
      if (!updated) throw AppError.conflict('Tài khoản đã thay đổi', 'VERSION_CONFLICT')
      const before = adminUserDto(target), after = adminUserDto(updated)
      await AuditLog.create([{ actorId, actorRole: 'admin', action, targetType: 'user', targetId, before, after, reason: input.reason, requestId }], { session })
      return after
    }, { maxCommitTimeMS: MAX_TIME_MS, timeoutMS: 15000 }) } finally { await session.endSession() }
  },
  async config() { return configDto(await SiteConfig.findById('global').maxTimeMS(MAX_TIME_MS).lean()) },
  async updateConfig(actorId: string, input: ConfigInput, requestId: string, actorVersion: number) {
    await ensureGuard()
    const session = await mongoose.startSession()
    try { return await session.withTransaction(async () => {
      const actor = await requireActor(actorId, session)
      if ((actor.authVersion ?? 0) !== actorVersion) throw AppError.forbidden('Phiên admin đã thay đổi', 'ADMIN_PERMISSION_CHANGED')
      const before = configDto(await SiteConfig.findById('global').session(session).lean())
      if (before.version !== input.expectedVersion) throw AppError.conflict('Cấu hình đã thay đổi', 'VERSION_CONFLICT')
      const after = { siteName: input.siteName, description: input.description, announcement: input.announcement, version: before.version + 1 }
      await SiteConfig.updateOne({ _id: 'global' }, { $set: after }, { session, upsert: true, runValidators: true })
      await AuditLog.create([{ actorId, actorRole: 'admin', action: 'config', targetType: 'config', targetId: 'global', before, after, reason: input.reason, requestId }], { session })
      return after
    }, { maxCommitTimeMS: MAX_TIME_MS, timeoutMS: 15000 }) } finally { await session.endSession() }
  },
  async overview() {
    const asOf = new Date()
    const [users, authors, stories, pendingStories, pendingChapters, openReports, publicChapters, topStories] = await Promise.all([
      User.countDocuments().maxTimeMS(MAX_TIME_MS), User.countDocuments({ role: 'author', authorStatus: 'approved', ...activeFilter(asOf) }).maxTimeMS(MAX_TIME_MS),
      Story.countDocuments({ moderationStatus: 'approved' }).maxTimeMS(MAX_TIME_MS), Story.countDocuments({ moderationStatus: 'pending' }).maxTimeMS(MAX_TIME_MS),
      Chapter.countDocuments({ moderationStatus: 'pending' }).maxTimeMS(MAX_TIME_MS), Report.countDocuments({ status: { $in: ['pending', 'in_progress'] } }).maxTimeMS(MAX_TIME_MS),
      Story.aggregate([{ $match: { moderationStatus: 'approved' } }, { $lookup: { from: Chapter.collection.name, localField: '_id', foreignField: 'storyId', pipeline: [{ $match: { status: 'published', moderationStatus: 'approved' } }, { $count: 'value' }], as: 'chapters' } }, { $group: { _id: null, value: { $sum: { $ifNull: [{ $arrayElemAt: ['$chapters.value', 0] }, 0] } } } }]).option({ maxTimeMS: MAX_TIME_MS }),
      Story.find({ moderationStatus: 'approved' }).sort({ viewCount: -1, _id: -1 }).limit(5).select('_id title slug viewCount contentWarning').maxTimeMS(MAX_TIME_MS).lean(),
    ])
    return { asOf, kpis: { users, authors, stories, publicChapters: publicChapters[0]?.value ?? 0, pendingStories, pendingChapters, openReports }, topStories: topStories.map(({ _id, ...item }) => ({ id: String(_id), ...item })) }
  },
  async charts(query: ChartsQuery) {
    const start = new Date(query.from), end = new Date(Date.parse(query.to) + 86400000)
    const rows: { _id: string; value: number }[] = query.metric === 'views'
      ? await AdminMetricSnapshot.aggregate([{ $match: { scopeVersion: 1, sampledAt: { $gte: start, $lt: end } } }, { $sort: { sampledAt: 1 } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$sampledAt', timezone: 'UTC' } }, value: { $last: '$viewCount' } } }]).option({ maxTimeMS: MAX_TIME_MS })
      : await (query.metric === 'users' ? User : Story).aggregate([{ $match: { createdAt: { $gte: start, $lt: end } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, value: { $sum: 1 } } }]).option({ maxTimeMS: MAX_TIME_MS })
    const values = new Map(rows.map(row => [row._id, row.value]))
    const points = []
    for (let time = start.getTime(); time < end.getTime(); time += 86400000) {
      const date = new Date(time).toISOString().slice(0, 10)
      points.push({ date, value: values.get(date) ?? (query.metric === 'views' ? null : 0) })
    }
    return { metric: query.metric, timezone: 'UTC', semantics: query.metric === 'views' ? 'Last hourly sample of all retained chapter counters; not daily reads' : 'Created records per UTC day', points }
  },
  async sampleMetrics(now = new Date()) {
    const sampledAt = new Date(Math.floor(now.getTime() / 3600000) * 3600000)
    const _id = `1:${sampledAt.toISOString()}`
    if (await AdminMetricSnapshot.exists({ _id }).maxTimeMS(MAX_TIME_MS)) return
    const rows = await Chapter.aggregate([{ $group: { _id: null, value: { $sum: '$viewCount' } } }]).option({ maxTimeMS: MAX_TIME_MS })
    try { await AdminMetricSnapshot.updateOne({ _id }, { $setOnInsert: { scopeVersion: 1, sampledAt, viewCount: rows[0]?.value ?? 0 } }, { upsert: true, maxTimeMS: MAX_TIME_MS }) }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error }
  },
}
