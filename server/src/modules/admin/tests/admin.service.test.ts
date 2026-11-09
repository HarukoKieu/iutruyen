import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminService, actionFingerprint } from '../admin.service.js'
import { adminRepository } from '../../../repositories/admin.repository.js'
import { redis } from '../../../config/redis.js'
import { comparePassword } from '../../../common/hash.js'
import { disconnectUserSockets } from '../../../config/socket.js'
vi.mock('../../../repositories/admin.repository.js', () => ({ adminRepository: { findIdentity: vi.fn(), mutateUser: vi.fn(), overview: vi.fn() } }))
vi.mock('../../../config/redis.js', () => ({ redis: { status: 'ready', set: vi.fn(), eval: vi.fn(), ping: vi.fn() } }))
vi.mock('../../../common/hash.js', () => ({ comparePassword: vi.fn() }))
vi.mock('../../../config/socket.js', () => ({ disconnectUserSockets: vi.fn() }))
const payload = { expectedVersion: 0, reason: 'Lý do kiểm thử hợp lệ' }
beforeEach(() => { vi.resetAllMocks(); adminService.invalidateOverview(); redis.status = 'ready'; vi.mocked(adminRepository.findIdentity).mockResolvedValue({ role: 'admin', isLocked: false, provider: 'local', password: 'HASH' } as never) })
afterEach(() => vi.useRealTimers())
describe('admin step-up receipts', () => {
  it('binds receipt to exact actor, access session, action, target and canonical payload', () => {
    const fp = actionFingerprint('actor', 'TOKEN', 'ban', 'target', payload)
    expect(fp).toBe(actionFingerprint('actor', 'TOKEN', 'ban', 'target', { reason: payload.reason, expectedVersion: 0 }))
    for (const other of [actionFingerprint('other', 'TOKEN', 'ban', 'target', payload), actionFingerprint('actor', 'OTHER', 'ban', 'target', payload), actionFingerprint('actor', 'TOKEN', 'unban', 'target', payload), actionFingerprint('actor', 'TOKEN', 'ban', 'other', payload), actionFingerprint('actor', 'TOKEN', 'ban', 'target', { ...payload, expectedVersion: 1 })]) expect(other).not.toBe(fp)
  })
  it('creates short-lived random receipt after password verification, storing no password/token', async () => {
    vi.mocked(comparePassword).mockResolvedValue(true)
    const result = await adminService.confirm('actor', 'TOKEN', 'ban', 'target', payload, 'PASSWORD', 0)
    expect(result.actionReceipt).toMatch(/^[a-f\d]{64}$/)
    expect(redis.set).toHaveBeenCalledWith(expect.stringMatching(/^admin:receipt:[a-f\d]{64}$/), expect.stringMatching(/^[a-f\d]{64}$/), 'EX', 300)
    expect(JSON.stringify(vi.mocked(redis.set).mock.calls)).not.toMatch(/PASSWORD|TOKEN|HASH/)
  })
  it('wrong password does not issue receipt', async () => {
    vi.mocked(comparePassword).mockResolvedValue(false)
    await expect(adminService.confirm('actor', 'TOKEN', 'ban', 'target', payload, 'bad', 0)).rejects.toMatchObject({ code: 'STEP_UP_FAILED' })
    expect(redis.set).not.toHaveBeenCalled()
  })
  it('OAuth-only cannot use password fallback', async () => {
    vi.mocked(adminRepository.findIdentity).mockResolvedValue({ role: 'admin', provider: 'google', isLocked: false } as never)
    await expect(adminService.confirm('actor', 'TOKEN', 'ban', 'target', payload, 'password', 0)).rejects.toMatchObject({ code: 'STEP_UP_UNAVAILABLE' })
    expect(comparePassword).not.toHaveBeenCalled()
  })
  it('revoked admin session cannot confirm', async () => {
    vi.mocked(adminRepository.findIdentity).mockResolvedValue({ role: 'admin', authVersion: 1 } as never)
    await expect(adminService.confirm('actor', 'TOKEN', 'ban', 'target', payload, 'password', 0)).rejects.toMatchObject({ code: 'ADMIN_PERMISSION_CHANGED' })
  })
  it('replay/mismatch never reaches transaction', async () => {
    vi.mocked(redis.eval).mockResolvedValue(0)
    await expect(adminService.mutateUser('actor', 'TOKEN', 'target', 'ban', payload, 'receipt', 'request', 0)).rejects.toMatchObject({ code: 'INVALID_ACTION_RECEIPT' })
    expect(adminRepository.mutateUser).not.toHaveBeenCalled()
  })
  it('disconnects sockets only after successful commit', async () => {
    vi.mocked(redis.eval).mockResolvedValue(1)
    vi.mocked(adminRepository.mutateUser).mockResolvedValue({ id: 'target' } as never)
    await adminService.mutateUser('actor', 'TOKEN', 'target', 'ban', payload, 'receipt', 'request', 0)
    expect(disconnectUserSockets).toHaveBeenCalledWith('target')
    vi.mocked(disconnectUserSockets).mockClear()
    vi.mocked(adminRepository.mutateUser).mockRejectedValue(new Error('audit write failure'))
    await expect(adminService.mutateUser('actor', 'TOKEN', 'target', 'ban', payload, 'receipt', 'request', 0)).rejects.toThrow('audit write failure')
    expect(disconnectUserSockets).not.toHaveBeenCalled()
  })
  it('Redis outage fails closed', async () => {
    redis.status = 'end'
    await expect(adminService.confirm('actor', 'TOKEN', 'ban', 'target', payload, 'password', 0)).rejects.toMatchObject({ statusCode: 503 })
  })
  it('coalesces overview reads, expires after 15 seconds and preserves the original asOf timestamp', async () => {
    vi.useFakeTimers()
    const first = { asOf: new Date(), kpis: { users: 2 } }
    vi.mocked(adminRepository.overview).mockResolvedValue(first as never)
    vi.mocked(redis.ping).mockResolvedValue('PONG')
    const results = await Promise.all(Array.from({ length: 10 }, () => adminService.overview()))
    expect(adminRepository.overview).toHaveBeenCalledTimes(1)
    expect(results.every(result => result.asOf === first.asOf)).toBe(true)
    await adminService.overview(); expect(adminRepository.overview).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(15001)
    await adminService.overview(); expect(adminRepository.overview).toHaveBeenCalledTimes(2)
  })
  it('a concurrent invalidation cannot republish an obsolete cache flight', async () => {
    let complete!: (value: Awaited<ReturnType<typeof adminRepository.overview>>) => void
    vi.mocked(adminRepository.overview).mockReturnValueOnce(new Promise(resolve => { complete = resolve })).mockResolvedValue({ asOf: new Date(), kpis: { users: 3 } } as never)
    const old = adminService.overview()
    adminService.invalidateOverview()
    complete({ asOf: new Date(), kpis: { users: 2 } } as never)
    await old
    const fresh = await adminService.overview()
    expect(fresh.kpis.users).toBe(3)
    expect(adminRepository.overview).toHaveBeenCalledTimes(2)
  })
})
