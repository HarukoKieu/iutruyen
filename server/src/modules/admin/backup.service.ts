import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'
import { backupRepository } from '../../repositories/backup.repository.js'
import { BackupFailure, createLocalBackupAdapter, loadLocalBackupConfig } from './local-backup.adapter.js'

export async function configuredBackupAdapter() {
  if (!env.BACKUP_LOCAL_DIR || !env.BACKUP_KEY_FILE || !env.BACKUP_MONGO_CONFIG_FILE) throw new BackupFailure('BACKUP_NOT_CONFIGURED')
  const config = await loadLocalBackupConfig({ directory: env.BACKUP_LOCAL_DIR, keyFile: env.BACKUP_KEY_FILE, mongoConfigFile: env.BACKUP_MONGO_CONFIG_FILE, uri: env.MONGODB_URI, timeoutMs: env.BACKUP_TIMEOUT_MS, maxBytes: env.BACKUP_MAX_BYTES, totalBytes: env.BACKUP_TOTAL_BYTES })
  return createLocalBackupAdapter(config)
}
let health: { status: string; reason: string; expiresAt: number } | undefined
let checking: Promise<{ status: string; reason: string; expiresAt: number }> | undefined
async function readHealth() {
  if (health && health.expiresAt > Date.now()) return health
  if (checking) return checking
  checking = (async () => {
    let status = 'READY', reason = 'Backup logical local mã hóa; không phải snapshot/PITR. Cần cửa sổ dừng ghi để bảo đảm nhất quán.'
    try { await (await configuredBackupAdapter()).check() } catch (error) {
      status = error instanceof BackupFailure && error.code === 'BACKUP_NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'UNAVAILABLE'
      reason = status === 'NOT_CONFIGURED' ? 'Chưa cấu hình thư mục riêng, file khóa và Mongo tools config.' : 'Storage, khóa hoặc Mongo tools chưa sẵn sàng; kiểm tra cấu hình riêng trên máy chủ.'
    }
    health = { status, reason, expiresAt: Date.now() + 15000 }
    return health
  })().finally(() => { checking = undefined })
  return checking
}
export const backupService = {
  async list(query: { cursor?: string; limit: number }) {
    const [{ status, reason }, page] = await Promise.all([readHealth(), backupRepository.list(query)])
    return { status, reason, ...page }
  },
  async enqueue(actorId: string, actorVersion: number, reason: string, requestId: string) {
    try { await (await configuredBackupAdapter()).check() } catch (error) {
      const code = error instanceof BackupFailure && error.code === 'BACKUP_NOT_CONFIGURED' ? 'BACKUP_NOT_CONFIGURED' : 'BACKUP_UNAVAILABLE'
      throw new AppError(503, 'Backup local chưa sẵn sàng; kiểm tra cấu hình riêng trên máy chủ', code)
    }
    return backupRepository.enqueue(actorId, actorVersion, reason, requestId)
  },
}
