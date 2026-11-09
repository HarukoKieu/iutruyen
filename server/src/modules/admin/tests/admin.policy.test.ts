import { describe, expect, it } from 'vitest'
import { isAccountLocked, isSessionCurrent } from '../../../common/accountState.js'
import { adminUserDto, planAccountMutation, type AdminAccount } from '../admin.policy.js'
import { actionPayloads, configSchema, chartsQuery, usersQuery, mutationSchema, confirmationSchema } from '../admin.validation.js'

const now = new Date('2026-10-12T00:00:00Z')
const account = (extra: Partial<AdminAccount> = {}): AdminAccount => ({ _id: { toString: () => 'a'.repeat(24) }, email: 'reader@example.test', username: 'reader', displayName: 'Reader', role: 'user', provider: 'local', isEmailVerified: true, isLocked: false, createdAt: now, ...extra })
const input = { expectedVersion: 0, reason: 'Lý do kiểm thử hợp lệ' }
describe('admin account state and safe contracts', () => {
  it.each([
    [{ isLocked: false }, false], [{ isLocked: true }, true], [{ isLocked: true, lockKind: 'ban', suspendedUntil: new Date(0) }, true],
    [{ isLocked: true, lockKind: 'suspend' }, true], [{ isLocked: true, lockKind: 'suspend', suspendedUntil: 'invalid' }, true],
    [{ isLocked: true, lockKind: 'suspend', suspendedUntil: now }, false], [{ isLocked: true, lockKind: 'suspend', suspendedUntil: new Date(now.getTime() + 1) }, true],
  ])('lock compatibility %j → %s', (user, locked) => expect(isAccountLocked(user, now.getTime())).toBe(locked))
  it('old session cannot return after unban', () => {
    expect(isSessionCurrent({}, {})).toBe(true)
    expect(isSessionCurrent({ authVersion: 1 }, {})).toBe(false)
    expect(isSessionCurrent({ authVersion: 1 }, { authVersion: 1 })).toBe(true)
    expect(isSessionCurrent({ authVersion: 1 }, { authVersion: '1' })).toBe(false)
  })
  it('rejects self modification and stale version', () => {
    expect(() => planAccountMutation('a'.repeat(24), account(), 'ban', input)).toThrow(/chính mình/)
    expect(() => planAccountMutation('actor', account({ adminVersion: 1 }), 'ban', input)).toThrow(/thay đổi/)
  })
  it('suspension has exact server deadline and revokes existing tokens', () => {
    const result = planAccountMutation('actor', account(), 'suspend', { ...input, days: 3 }, now)
    expect(result.patch).toMatchObject({ adminVersion: 1, authVersion: 1, isLocked: true, lockKind: 'suspend', suspendedUntil: new Date('2026-10-15T00:00:00Z') })
  })
  it('cannot accidentally convert a permanent or legacy ban into an expiring suspension', () => {
    expect(() => planAccountMutation('actor', account({ isLocked: true }), 'suspend', { ...input, days: 1 }, now)).toThrow(/mở khóa ban/)
    expect(() => planAccountMutation('actor', account({ isLocked: true, lockKind: 'ban' }), 'suspend', { ...input, days: 1 }, now)).toThrow(/mở khóa ban/)
  })
  it('unban clears suspension but preserves revoked epoch', () => {
    expect(planAccountMutation('actor', account({ isLocked: true, authVersion: 4 }), 'unban', input).patch).toEqual({ adminVersion: 1, isLocked: false, lockKind: null, lockedReason: null, suspendedUntil: null })
  })
  it('approves pending author and revokes approved author to reader', () => {
    expect(planAccountMutation('actor', account({ authorStatus: 'pending' }), 'author-status', { ...input, status: 'approved' }).patch).toMatchObject({ role: 'author', authorStatus: 'approved', authVersion: 1 })
    expect(planAccountMutation('actor', account({ role: 'author', authorStatus: 'approved' }), 'author-status', { ...input, status: 'revoked' }).patch).toMatchObject({ role: 'user', authorStatus: 'revoked' })
  })
  it.each(['admin', 'moderator'])('author review cannot overwrite %s', role => {
    expect(() => planAccountMutation('actor', account({ role, authorStatus: 'pending' }), 'author-status', { ...input, status: 'approved' })).toThrow(/quản trị/)
  })
  it('cannot promote unapproved author or perform no-op role mutation', () => {
    expect(() => planAccountMutation('actor', account(), 'role', { ...input, role: 'author' })).toThrow(/duyệt tác giả/)
    expect(() => planAccountMutation('actor', account(), 'role', { ...input, role: 'user' })).toThrow(/hiệu lực/)
  })
  it('counts only reductions of currently active admins', () => {
    expect(planAccountMutation('actor', account({ role: 'admin' }), 'role', { ...input, role: 'user' }).reducesAdmin).toBe(true)
    expect(planAccountMutation('actor', account({ role: 'admin', isLocked: true }), 'role', { ...input, role: 'user' }).reducesAdmin).toBe(false)
  })
  it('DTO removes credentials, epoch and unbounded base64', () => {
    const dto = adminUserDto({ ...account(), password: 'HASH', providerId: 'SECRET', avatarUrl: 'BASE64', authVersion: 5 } as AdminAccount)
    expect(JSON.stringify(dto)).not.toMatch(/HASH|SECRET|BASE64|authVersion/)
    expect(dto).toMatchObject({ adminVersion: 0, id: 'a'.repeat(24) })
  })
  it.each([{ role: { $ne: 'admin' } }, { limit: '1000' }, { q: 'a'.repeat(101) }, { foo: 'x' }, { cursor: ['a'] }])('rejects unsafe query %j', query => expect(usersQuery.safeParse(query).success).toBe(false))
  it('strict mutation rejects operator/mass assignment', () => {
    expect(mutationSchema('ban').safeParse({ ...input, actionReceipt: 'a'.repeat(64), role: 'admin' }).success).toBe(false)
    expect(actionPayloads.suspend.safeParse({ ...input, days: 31 }).success).toBe(false)
    expect(confirmationSchema.safeParse({ action: 'ban', targetId: 'a'.repeat(24), password: 'password', payload: { ...input, adminVersion: 2 } }).success).toBe(false)
  })
  it.each([{ from: '2026-02-30', to: '2026-03-01' }, { from: '2026-10-12', to: '2026-10-11' }, { from: '2026-01-01', to: '2026-04-01' }])('rejects invalid chart range %j', range => expect(chartsQuery.safeParse({ metric: 'users', ...range }).success).toBe(false))
  it('configuration only accepts bounded plain text', () => {
    const valid = { expectedVersion: 0, reason: input.reason, siteName: 'Test', description: '', announcement: '' }
    expect(configSchema.safeParse(valid).success).toBe(true)
    expect(configSchema.safeParse({ ...valid, announcement: '<script>x</script>' }).success).toBe(false)
    expect(configSchema.safeParse({ ...valid, JWT_PRIVATE_KEY: 'secret' }).success).toBe(false)
  })
})
