import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackupWorker } from '../../../jobs/local-backup.job.js'
import { backupRepository } from '../../../repositories/backup.repository.js'
import { BackupFailure } from '../local-backup.adapter.js'

vi.mock('../../../repositories/backup.repository.js', () => ({ backupRepository: { recover: vi.fn(), claim: vi.fn(), heartbeat: vi.fn(), finish: vi.fn() } }))
const id = 'a'.repeat(24), result = { artifactKey: 'internal', sizeBytes: 123, sha256: 'checksum' }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(backupRepository.claim).mockResolvedValue({ _id: id } as never); vi.mocked(backupRepository.finish).mockResolvedValue(true); vi.mocked(backupRepository.heartbeat).mockResolvedValue(true) })
afterEach(() => vi.useRealTimers())
describe('backup worker lifecycle', () => {
  it('coalesces concurrent ticks and commits success only after dump returns', async () => {
    let resolve!: (value: typeof result) => void
    const dump = vi.fn(() => new Promise<typeof result>(callback => { resolve = callback }))
    const worker = createBackupWorker(async () => ({ dump, check: vi.fn() }))
    const first = worker.tick(), second = worker.tick()
    await vi.waitFor(() => expect(dump).toHaveBeenCalledTimes(1))
    expect(backupRepository.finish).not.toHaveBeenCalled()
    resolve(result); await Promise.all([first, second])
    expect(backupRepository.claim).toHaveBeenCalledTimes(1)
    expect(backupRepository.finish).toHaveBeenCalledWith(id, expect.any(String), result)
    await worker.stop()
  })
  it('redacts unexpected adapter errors and records failed jobs', async () => {
    const worker = createBackupWorker(async () => ({ dump: vi.fn().mockRejectedValue(new Error('mongodb://SECRET')), check: vi.fn() }))
    await worker.tick()
    expect(backupRepository.finish).toHaveBeenCalledWith(id, expect.any(String), { errorCode: 'BACKUP_WORKER_FAILED' })
    expect(JSON.stringify(vi.mocked(backupRepository.finish).mock.calls)).not.toContain('SECRET')
    await worker.stop()
  })
  it('stop during claim aborts the resulting job and prevents future ticks', async () => {
    let claim!: (value: never) => void
    vi.mocked(backupRepository.claim).mockReturnValue(new Promise(resolve => { claim = resolve }) as never)
    const dump = vi.fn(async (_id: string, _owner: string, signal: AbortSignal) => { expect(signal.aborted).toBe(true); throw new BackupFailure('BACKUP_ABORTED') })
    const worker = createBackupWorker(async () => ({ dump, check: vi.fn() }))
    const tick = worker.tick(); await vi.waitFor(() => expect(backupRepository.claim).toHaveBeenCalled())
    const stop = worker.stop(); claim({ _id: id } as never)
    await Promise.all([tick, stop]); await worker.tick()
    expect(backupRepository.claim).toHaveBeenCalledTimes(1)
    expect(backupRepository.finish).toHaveBeenCalledWith(id, expect.any(String), { errorCode: 'BACKUP_ABORTED' })
  })
  it('heartbeat rejection cancels the active dump and cannot publish success', async () => {
    vi.useFakeTimers()
    vi.mocked(backupRepository.heartbeat).mockResolvedValue(false)
    const dump = vi.fn((_id: string, _owner: string, signal: AbortSignal) => new Promise<typeof result>((_resolve, reject) => signal.addEventListener('abort', () => reject(new BackupFailure('BACKUP_ABORTED')), { once: true })))
    const worker = createBackupWorker(async () => ({ dump, check: vi.fn() }))
    const tick = worker.tick()
    await vi.advanceTimersByTimeAsync(15001)
    await tick
    expect(backupRepository.finish).toHaveBeenCalledWith(id, expect.any(String), { errorCode: 'BACKUP_LEASE_LOST' })
    await worker.stop()
  })
})
