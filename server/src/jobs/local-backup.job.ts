import { randomUUID } from 'node:crypto'
import { backupRepository } from '../repositories/backup.repository.js'
import { configuredBackupAdapter } from '../modules/admin/backup.service.js'
import { BackupFailure } from '../modules/admin/local-backup.adapter.js'
import { logger } from '../common/logger.js'

/** Durable queue and owner-fenced lease; the adapter factory is injectable for isolated tools tests. */
export function createBackupWorker(adapter = configuredBackupAdapter, repository = backupRepository) {
  let running: Promise<void> | undefined, controller: AbortController | undefined, stopped = false
  async function perform() {
    await repository.recover()
    const owner = randomUUID(), job = await repository.claim(owner)
    if (!job) return
    const id = String(job._id)
    const localController = new AbortController()
    controller = localController
    if (stopped) localController.abort()
    let lostLease = false, heartbeatFlight: Promise<void> | undefined
    const heartbeat = setInterval(() => {
      if (heartbeatFlight) return
      heartbeatFlight = repository.heartbeat(id, owner).then(ok => { if (!ok) { lostLease = true; localController.abort() } }).catch(() => { lostLease = true; localController.abort() }).finally(() => { heartbeatFlight = undefined })
    }, 15000)
    heartbeat.unref()
    try {
      const result = await (await adapter()).dump(id, owner, localController.signal)
      if (lostLease) throw new BackupFailure('BACKUP_LEASE_LOST')
      if (!await repository.finish(id, owner, result)) throw new BackupFailure('BACKUP_LEASE_LOST')
    } catch (error) {
      // No raw child stderr/URI/path in logs or database.
      const errorCode = lostLease ? 'BACKUP_LEASE_LOST' : error instanceof BackupFailure ? error.code : 'BACKUP_WORKER_FAILED'
      await repository.finish(id, owner, { errorCode })
    } finally { clearInterval(heartbeat); await heartbeatFlight; controller = undefined }
  }
  return {
    tick() {
      if (stopped) return Promise.resolve()
      if (!running) running = perform().finally(() => { running = undefined })
      return running
    },
    async stop() { stopped = true; controller?.abort(); await running },
  }
}
const worker = createBackupWorker()
let timer: NodeJS.Timeout | undefined
export function startLocalBackups() {
  const tick = () => { void worker.tick().catch(() => logger.error('Local backup worker unavailable', { code: 'BACKUP_WORKER_UNAVAILABLE' })) }
  tick(); timer = setInterval(tick, 5000); timer.unref()
}
export async function stopLocalBackups() { clearInterval(timer); await worker.stop() }
