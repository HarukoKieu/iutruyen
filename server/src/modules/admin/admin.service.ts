import { createHash, randomBytes } from 'node:crypto'
import { adminRepository } from '../../repositories/admin.repository.js'
import { redis } from '../../config/redis.js'
import { disconnectUserSockets } from '../../config/socket.js'
import { comparePassword } from '../../common/hash.js'
import { AppError } from '../../common/AppError.js'
import { isAccountLocked } from '../../common/accountState.js'
import { backupService } from './backup.service.js'
import { actionPayloads, type Action, type ActionPayload, type UsersQuery, type StoriesQuery, type AuditQuery, type ChartsQuery, type ConfigInput } from './admin.validation.js'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
// Strict schemas establish canonical property order; never fingerprint arbitrary JSON from a request.
export function actionFingerprint(actorId: string, sessionToken: string, action: Action, targetId: string, payload: ActionPayload) {
  return hash(JSON.stringify([actorId, hash(sessionToken), action, targetId, actionPayloads[action].parse(payload)]))
}
export const CONSUME_RECEIPT_SCRIPT = `local value = redis.call('GET', KEYS[1])
if value ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
return 1`
function requireRedis() { if (redis.status !== 'ready') throw new AppError(503, 'Không thể xác minh hành động lúc này', 'STEP_UP_UNAVAILABLE') }
let overviewCache: { value: Awaited<ReturnType<typeof adminRepository.overview>>; expiresAt: number } | undefined
let overviewFlight: Promise<Awaited<ReturnType<typeof adminRepository.overview>>> | undefined
let overviewRevision = 0
function invalidateOverview() { overviewRevision++; overviewCache = undefined; overviewFlight = undefined }
async function readOverview() {
  if (overviewCache && overviewCache.expiresAt > Date.now()) return overviewCache.value
  if (overviewFlight) return overviewFlight
  const revision = overviewRevision
  const flight = adminRepository.overview().then(value => { if (revision === overviewRevision) overviewCache = { value, expiresAt: Date.now() + 15000 }; return value }).finally(() => { if (overviewFlight === flight) overviewFlight = undefined })
  overviewFlight = flight
  return flight
}

/** Admin application services have no dependency on Express request/response. */
export const adminService = {
  invalidateOverview,
  users: (query: UsersQuery) => adminRepository.users(query),
  user: (id: string) => adminRepository.user(id),
  stories: (query: StoriesQuery) => adminRepository.stories(query),
  audit: (query: AuditQuery) => adminRepository.audit(query),
  charts: (query: ChartsQuery) => adminRepository.charts(query),
  config: () => adminRepository.config(),
  async updateConfig(actorId: string, input: ConfigInput, requestId: string, actorVersion: number) {
    const result = await adminRepository.updateConfig(actorId, input, requestId, actorVersion)
    invalidateOverview()
    return result
  },
  async overview() {
    let data
    try { data = await readOverview() } catch (error) {
      if ((error as { code?: number }).code === 50) throw new AppError(503, 'Dashboard vượt thời gian truy vấn; vui lòng thử lại', 'ADMIN_QUERY_TIMEOUT')
      throw error
    }
    let redisStatus: 'available' | 'unavailable' = 'unavailable'
    try { if (redis.status === 'ready' && await redis.ping() === 'PONG') redisStatus = 'available' } catch { /* honest dependency state */ }
    return { ...data, health: { checkedAt: new Date(), mongodb: 'available', redis: redisStatus } }
  },
  async confirm(actorId: string, sessionToken: string, action: Action, targetId: string, payload: ActionPayload, password: string, actorVersion: number) {
    requireRedis()
    const actor = await adminRepository.findIdentity(actorId)
    if (!actor || actor.role !== 'admin' || isAccountLocked(actor) || (actor.authVersion ?? 0) !== actorVersion) throw AppError.forbidden('Quyền admin đã thay đổi', 'ADMIN_PERMISSION_CHANGED')
    if (actor.provider !== 'local' || !actor.password) throw AppError.conflict('Tài khoản này cần luồng xác thực lại OAuth chưa được cấu hình', 'STEP_UP_UNAVAILABLE')
    if (!await comparePassword(password, actor.password)) throw AppError.forbidden('Mật khẩu xác minh không đúng', 'STEP_UP_FAILED')
    const receipt = randomBytes(32).toString('hex')
    await redis.set(`admin:receipt:${hash(receipt)}`, actionFingerprint(actorId, sessionToken, action, targetId, payload), 'EX', 300)
    return { actionReceipt: receipt, expiresIn: 300 }
  },
  async mutateUser(actorId: string, sessionToken: string, targetId: string, action: Action, payload: ActionPayload, receipt: string, requestId: string, actorVersion: number) {
    requireRedis()
    const used = await redis.eval(CONSUME_RECEIPT_SCRIPT, 1, `admin:receipt:${hash(receipt)}`, actionFingerprint(actorId, sessionToken, action, targetId, payload))
    if (used !== 1) throw AppError.conflict('Xác nhận hết hạn/đã dùng hoặc không khớp; xác minh lại', 'INVALID_ACTION_RECEIPT')
    const result = await adminRepository.mutateUser(actorId, targetId, action, payload, requestId, actorVersion)
    invalidateOverview()
    if (action !== 'unban') disconnectUserSockets(targetId)
    return result
  },
  backups: backupService.list,
  enqueueBackup: backupService.enqueue,
}
