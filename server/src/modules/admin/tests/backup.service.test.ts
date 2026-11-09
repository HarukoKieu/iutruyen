import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackupFailure } from '../local-backup.adapter.js'
const mocks = vi.hoisted(() => ({ env: { BACKUP_LOCAL_DIR: 'DIR', BACKUP_KEY_FILE: 'KEY', BACKUP_MONGO_CONFIG_FILE: 'CONFIG', MONGODB_URI: 'mongodb://127.0.0.1/test' }, load: vi.fn(), check: vi.fn(), list: vi.fn(), enqueue: vi.fn() }))
vi.mock('../../../config/env.js', () => ({ env: mocks.env }))
vi.mock('../../../repositories/backup.repository.js', () => ({ backupRepository: { list: mocks.list, enqueue: mocks.enqueue } }))
vi.mock('../local-backup.adapter.js', async importOriginal => ({ ...await importOriginal<typeof import('../local-backup.adapter.js')>(), loadLocalBackupConfig: mocks.load, createLocalBackupAdapter: () => ({ check: mocks.check }) }))
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.useFakeTimers()
  mocks.env.BACKUP_LOCAL_DIR = 'DIR'; mocks.check.mockResolvedValue(undefined); mocks.load.mockResolvedValue({})
  mocks.list.mockResolvedValue({ items: [], meta: { limit: 20, hasMore: false, nextCursor: null } })
})
afterEach(() => vi.useRealTimers())
describe('backup service readiness and enqueue', () => {
  it('coalesces concurrent CLI readiness probes with bounded stale time; job history stays fresh', async () => {
    const { backupService } = await import('../backup.service.js')
    const results = await Promise.all(Array.from({ length: 10 }, () => backupService.list({ limit: 20 })))
    expect(results.every(r => r.status === 'READY')).toBe(true)
    expect(mocks.check).toHaveBeenCalledTimes(1); expect(mocks.list).toHaveBeenCalledTimes(10)
    await vi.advanceTimersByTimeAsync(15001); await backupService.list({ limit: 20 })
    expect(mocks.check).toHaveBeenCalledTimes(2)
  })
  it('missing local config is honest and cannot create accepted jobs', async () => {
    mocks.env.BACKUP_LOCAL_DIR = ''
    const { backupService } = await import('../backup.service.js')
    expect(await backupService.list({ limit: 20 })).toMatchObject({ status: 'NOT_CONFIGURED', items: [] })
    await expect(backupService.enqueue('actor', 0, 'Valid backup reason', 'req')).rejects.toMatchObject({ statusCode: 503, code: 'BACKUP_NOT_CONFIGURED' })
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })
  it('cached READY never bypasses fresh preflight on enqueue and private errors are redacted', async () => {
    const { backupService } = await import('../backup.service.js')
    expect((await backupService.list({ limit: 20 })).status).toBe('READY')
    mocks.check.mockRejectedValue(new Error('SECRET_URI_PRIVATE_PATH'))
    await expect(backupService.enqueue('actor', 0, 'Valid backup reason', 'req')).rejects.toMatchObject({ code: 'BACKUP_UNAVAILABLE' })
    expect(mocks.enqueue).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(15001)
    const history = await backupService.list({ limit: 20 })
    expect(history.status).toBe('UNAVAILABLE'); expect(JSON.stringify(history)).not.toContain('SECRET')
  })
  it('runtime/key/config failure never inserts a fake queued job', async () => {
    mocks.load.mockRejectedValue(new BackupFailure('BACKUP_INVALID_KEY'))
    const { backupService } = await import('../backup.service.js')
    await expect(backupService.enqueue('actor', 0, 'Valid backup reason', 'req')).rejects.toMatchObject({ code: 'BACKUP_UNAVAILABLE' })
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })
})
