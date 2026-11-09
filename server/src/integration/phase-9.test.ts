import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { writeFile, mkdtemp, readdir, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import http from 'node:http'
import mongoose, { Types } from 'mongoose'
vi.mock('../config/env.js', async () => {
  const { generateKeyPairSync } = await import('node:crypto')
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  return { env: { NODE_ENV: 'test', LOG_LEVEL: 'error', JWT_PRIVATE_KEY: keys.privateKey, JWT_PUBLIC_KEY: keys.publicKey, CLIENT_URL: 'http://localhost:5173', PUBLIC_SITE_URL: 'https://example.test', SEO_INDEXABLE: false, REDIS_HOST: '127.0.0.1', REDIS_PORT: 6389, REDIS_PASSWORD: '', TRUST_PROXY: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: '', CRAWLER_SOURCES_JSON: '[]' } }
})
import app from '../app.js'
import { redis } from '../config/redis.js'
import { User } from '../models/User.model.js'
import { Story } from '../models/Story.model.js'
import { Chapter } from '../models/Chapter.model.js'
import { Report } from '../models/Report.model.js'
import { AuditLog } from '../models/AuditLog.model.js'
import { AdminControl } from '../models/AdminControl.model.js'
import { SiteConfig } from '../models/SiteConfig.model.js'
import { AdminMetricSnapshot } from '../models/AdminMetricSnapshot.model.js'
import { BackupJob } from '../models/BackupJob.model.js'
import { backupRepository } from '../repositories/backup.repository.js'
import { createLocalBackupAdapter, verifyEncryptedBackup, type ToolRunner } from '../modules/admin/local-backup.adapter.js'
import { createBackupWorker } from '../jobs/local-backup.job.js'
import { restoreToIsolatedDatabase } from '../modules/admin/local-backup.restore.js'
import { signAccessToken, signRefreshToken, signEmailVerificationToken } from '../common/jwt.js'
import { hashPassword } from '../common/hash.js'
import { adminRepository } from '../repositories/admin.repository.js'
import { adminService } from '../modules/admin/admin.service.js'
import { actionFingerprint, CONSUME_RECEIPT_SCRIPT } from '../modules/admin/admin.service.js'
import { authenticateSocket, initSocket, closeSocket, emitToUser, disconnectUserSockets, type AuthenticatedSocket } from '../config/socket.js'
import type { Action, ActionPayload } from '../modules/admin/admin.validation.js'

const enabled = process.env.RUN_PHASE_9_INTEGRATION === '1'
const testMongoContainer = process.env.TEST_MONGO_CONTAINER || 'codex-phase9-mongo-20261012'
const database = `novel_phase9_test_${randomUUID().replaceAll('-', '')}`
const password = 'Phase9!TestPassword'
const reason = 'Lý do kiểm thử quản trị hợp lệ'
let passwordHash: string, actorId: string, actorToken: string, baseUrl: string
const server = http.createServer(app)
interface TestSocket {
  once(event: string, handler: (value: unknown) => void): void
  off(event: string, handler: (value: unknown) => void): void
  connect(): void
  disconnect(): void
}
const waitEvent = (socket: TestSocket, event: string) => new Promise<unknown>((resolve, reject) => {
  const listener = (value: unknown) => { clearTimeout(timer); resolve(value) }
  const timer = setTimeout(() => { socket.off(event, listener); reject(new Error(`Socket event timeout: ${event}`)) }, 3000)
  socket.once(event, listener)
})
let serial = 0
async function createUser(extra = {}) {
  const name = `p9_${++serial}_${randomUUID().slice(0, 8)}`
  return User.create({ username: name, email: `${name}@example.test`, displayName: name, password: passwordHash, provider: 'local', isEmailVerified: true, ...extra })
}
async function request(path: string, token: string | null = actorToken, method = 'GET', body?: object) {
  const response = await fetch(baseUrl + '/api/v1' + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const text = await response.text()
  return { status: response.status, headers: response.headers, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) as any : { text } }
}
async function confirm(targetId: string, action: Action, payload: ActionPayload, token = actorToken) {
  const result = await request('/admin/action-confirmations', token, 'POST', { action, targetId, payload, password })
  expect(result.status).toBe(200)
  return result.body.data.actionReceipt as string
}
describe.skipIf(!enabled)('Phase 9 real Mongo replica set, Redis and HTTP', () => {
  beforeAll(async () => {
    await mongoose.connect(`mongodb://127.0.0.1:27028/${database}?directConnection=true&replicaSet=rs0`, { serverSelectionTimeoutMS: 5000 })
    await redis.connect()
    await Promise.all([User.init(), Story.init(), Chapter.init(), Report.init(), AuditLog.init(), AdminControl.init(), SiteConfig.init(), AdminMetricSnapshot.init(), BackupJob.init()])
    passwordHash = await hashPassword(password)
    initSocket(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  }, 30000)
  beforeEach(async () => {
    adminService.invalidateOverview()
    await Promise.all([User.deleteMany({}), Story.deleteMany({}), Chapter.deleteMany({}), Report.deleteMany({}), AuditLog.deleteMany({}), SiteConfig.deleteMany({}), AdminMetricSnapshot.deleteMany({}), BackupJob.deleteMany({})])
    const actor = await createUser({ role: 'admin' }); actorId = String(actor._id)
    actorToken = signAccessToken({ id: actorId, role: 'admin', authVersion: 0 })
  })
  afterAll(async () => {
    await closeSocket()
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    // Only random, explicitly test-prefixed database; never read .env database credentials.
    if (mongoose.connection.name === database && database.startsWith('novel_phase9_test_')) await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
    if (redis.status === 'ready') await redis.quit(); else redis.disconnect()
  })
  it('rejects guests, all non-admin roles and non-access JWT purposes', async () => {
    expect((await request('/admin/users', null)).status).toBe(401)
    for (const role of ['user', 'author', 'moderator']) {
      const user = await createUser({ role })
      expect((await request('/admin/users', signAccessToken({ id: String(user._id), role: 'admin' }))).status).toBe(403)
    }
    for (const token of [signRefreshToken({ id: actorId }), signEmailVerificationToken({ id: actorId })]) expect((await request('/admin/users', token)).status).toBe(401)
    const result = await request('/admin/users')
    expect(result.headers.get('cache-control')).toContain('no-store')
    expect(result.headers.get('x-robots-tag')).toContain('noindex')
  })
  it('paginates same-timestamp users without duplicates and binds filters, redacting credentials/base64', async () => {
    const time = new Date('2026-10-01')
    await Promise.all(Array.from({ length: 5 }, () => createUser({ createdAt: time, avatarUrl: 'SECRET_BASE64' })))
    const first = await request('/admin/users?role=user&limit=2')
    const second = await request(`/admin/users?role=user&limit=2&cursor=${first.body.meta.nextCursor}`)
    const third = await request(`/admin/users?role=user&limit=2&cursor=${second.body.meta.nextCursor}`)
    const ids = [...first.body.data, ...second.body.data, ...third.body.data].map((row: { id: string }) => row.id)
    expect(new Set(ids).size).toBe(5); expect(third.body.meta.hasMore).toBe(false)
    expect(JSON.stringify(first.body)).not.toMatch(/password|authVersion|SECRET_BASE64/)
    expect((await request(`/admin/users?role=admin&cursor=${first.body.meta.nextCursor}`)).status).toBe(400)
    expect((await request('/admin/users?cursor=garbage')).status).toBe(400)
    expect((await request('/admin/users?role[$ne]=admin')).status).toBe(400)
    expect((await request('/admin/users?limit=1001')).status).toBe(400)
    expect((await request('/admin/users?q=.*')).body.data).toEqual([])
  })
  it('suspend expiry is enforced by HTTP, refresh and Socket independent of cron', async () => {
    const user = await createUser({ isLocked: true, lockKind: 'suspend', suspendedUntil: new Date(Date.now() - 1000), authVersion: 2 })
    const token = signAccessToken({ id: String(user._id), authVersion: 2 })
    const me = await request('/users/me', token)
    expect(me.status).toBe(200)
    expect(me.body.data.isLocked).toBe(false)
    const socket = { handshake: { auth: { token }, headers: {} }, data: {} } as unknown as AuthenticatedSocket
    await expect(authenticateSocket(socket)).resolves.toBeUndefined()
    const oldToken = signAccessToken({ id: String(user._id), authVersion: 1 })
    expect((await request('/users/me', oldToken)).status).toBe(401)
    await expect(authenticateSocket({ handshake: { auth: { token: oldToken }, headers: {} }, data: {} } as unknown as AuthenticatedSocket)).rejects.toThrow()
    const { createSession, refresh } = await import('../modules/auth/auth.service.js')
    const session = await createSession({ id: String(user._id), authVersion: 2 })
    await expect(refresh(session.refreshToken)).resolves.toHaveProperty('accessToken')
    await User.updateOne({ _id: user._id }, { $inc: { authVersion: 1 } })
    await expect(refresh(session.refreshToken)).rejects.toMatchObject({ code: 'TOKEN_REVOKED' })
    const legacy = await createUser({ isLocked: true })
    expect((await request('/users/me', signAccessToken({ id: String(legacy._id) }))).status).toBe(401)
  })
  it('receipt is session/action/target/payload bound, consumed once, and ban/unban never revives sessions', async () => {
    const target = await createUser(), targetId = String(target._id)
    const oldToken = signAccessToken({ id: targetId })
    const payload = { expectedVersion: 0, reason }
    const receipt = await confirm(targetId, 'ban', payload)
    const mismatch = await request(`/admin/users/${targetId}/ban`, actorToken, 'PATCH', { ...payload, reason: 'Khác payload đã xác nhận', actionReceipt: receipt })
    expect(mismatch.body.code).toBe('INVALID_ACTION_RECEIPT')
    const applied = await request(`/admin/users/${targetId}/ban`, actorToken, 'PATCH', { ...payload, actionReceipt: receipt })
    expect(applied.status).toBe(200); expect(applied.body.data).toMatchObject({ isLocked: true, adminVersion: 1 })
    expect((await request(`/admin/users/${targetId}/ban`, actorToken, 'PATCH', { ...payload, actionReceipt: receipt })).body.code).toBe('INVALID_ACTION_RECEIPT')
    expect((await request('/users/me', oldToken)).status).toBe(401)
    const unlockPayload = { expectedVersion: 1, reason }
    const unlock = await confirm(targetId, 'unban', unlockPayload)
    expect((await request(`/admin/users/${targetId}/unban`, actorToken, 'PATCH', { ...unlockPayload, actionReceipt: unlock })).status).toBe(200)
    expect((await request('/users/me', oldToken)).status).toBe(401)
    expect(await AuditLog.countDocuments({ targetId })).toBe(2)
    expect(JSON.stringify(await AuditLog.find({}).lean())).not.toContain(passwordHash)
  })
  it('private Socket events exclude obsolete epochs immediately, and account actions disconnect all local sessions', async () => {
    const target = await createUser(), id = String(target._id)
    const { io } = createRequire(path.resolve('../client/package.json'))('socket.io-client') as { io: (url: string, options: object) => TestSocket }
    const old = io(baseUrl, { autoConnect: false, reconnection: false, transports: ['websocket'], auth: { token: signAccessToken({ id, authVersion: 0 }) } })
    const fresh = io(baseUrl, { autoConnect: false, reconnection: false, transports: ['websocket'], auth: { token: signAccessToken({ id, authVersion: 1 }) } })
    try {
      const ready = waitEvent(old, 'connect'); old.connect(); await ready
      const initial = waitEvent(old, 'notification:new'); await emitToUser(id, 'notification:new', { epoch: 0 }); expect(await initial).toEqual({ epoch: 0 })
      await User.updateOne({ _id: id }, { $inc: { authVersion: 1 } })
      const connected = waitEvent(fresh, 'connect'); fresh.connect(); await connected
      let oldReceived = false; old.once('notification:new', () => { oldReceived = true })
      const current = waitEvent(fresh, 'notification:new'); await emitToUser(id, 'notification:new', { epoch: 1 }); expect(await current).toEqual({ epoch: 1 })
      await new Promise(resolve => setTimeout(resolve, 100)); expect(oldReceived).toBe(false)
      const oldClosed = waitEvent(old, 'disconnect'), freshClosed = waitEvent(fresh, 'disconnect')
      disconnectUserSockets(id)
      expect(await oldClosed).toBe('io server disconnect'); expect(await freshClosed).toBe('io server disconnect')
    } finally { old.disconnect(); fresh.disconnect() }
  }, 15000)
  it('Lua consumes an expiring receipt atomically under concurrency and rejects expired/session-mismatched receipts', async () => {
    const receipt = randomUUID(), key = `admin:receipt:${createHash('sha256').update(receipt).digest('hex')}`
    const fp = actionFingerprint(actorId, actorToken, 'ban', actorId, { expectedVersion: 0, reason })
    await redis.set(key, fp, 'PX', 10000)
    const results = await Promise.all(Array.from({ length: 12 }, () => redis.eval(CONSUME_RECEIPT_SCRIPT, 1, key, fp)))
    expect(results.filter(value => value === 1)).toHaveLength(1)
    await redis.set(key, fp, 'PX', 1)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(await redis.eval(CONSUME_RECEIPT_SCRIPT, 1, key, fp)).toBe(0)
    const target = await createUser(), id = String(target._id)
    const result = await confirm(id, 'ban', { expectedVersion: 0, reason })
    await expect(adminService.mutateUser(actorId, 'OTHER_SESSION', id, 'ban', { expectedVersion: 0, reason }, result, 'test', 0)).rejects.toMatchObject({ code: 'INVALID_ACTION_RECEIPT' })
  })
  it('rejects wrong password, OAuth fallback and self-mutation', async () => {
    const target = await createUser(), payload = { expectedVersion: 0, reason }
    expect((await request('/admin/action-confirmations', actorToken, 'POST', { action: 'ban', targetId: String(target._id), payload, password: 'bad' })).body.code).toBe('STEP_UP_FAILED')
    const google = await createUser({ role: 'admin', provider: 'google', password: undefined })
    expect((await request('/admin/action-confirmations', signAccessToken({ id: String(google._id) }), 'POST', { action: 'ban', targetId: String(target._id), payload, password })).body.code).toBe('STEP_UP_UNAVAILABLE')
    const receipt = await confirm(actorId, 'ban', payload)
    expect((await request(`/admin/users/${actorId}/ban`, actorToken, 'PATCH', { ...payload, actionReceipt: receipt })).body.code).toBe('SELF_ADMIN_ACTION')
  })
  it('only one simultaneous versioned mutation commits', async () => {
    const target = await createUser(), id = String(target._id), payload = { expectedVersion: 0, reason }
    const results = await Promise.allSettled([
      adminRepository.mutateUser(actorId, id, 'ban', payload, 'one', 0), adminRepository.mutateUser(actorId, id, 'suspend', { ...payload, days: 3 }, 'two', 0),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(await AuditLog.countDocuments({ targetId: id })).toBe(1)
    expect((await User.findById(id))?.adminVersion).toBe(1)
  })
  it('two admins cannot demote one another concurrently, and a demoted actor cannot mutate with a stale JWT', async () => {
    const second = await createUser({ role: 'admin' }), secondId = String(second._id)
    const payload = { expectedVersion: 0, reason, role: 'user' as const }
    const results = await Promise.allSettled([
      adminRepository.mutateUser(actorId, secondId, 'role', payload, 'race-a', 0), adminRepository.mutateUser(secondId, actorId, 'role', payload, 'race-b', 0),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(await User.countDocuments({ role: 'admin', isLocked: false })).toBe(1)
    expect(await AuditLog.countDocuments()).toBe(1)
    const demoted = await User.findOne({ role: 'user' })
    const token = String(demoted!._id) === actorId ? actorToken : signAccessToken({ id: secondId, role: 'admin' })
    expect((await request('/admin/users', token)).status).toBe(401)
  })
  it('audit failure rolls back account/config mutations', async () => {
    const target = await createUser(), id = String(target._id)
    const spy = vi.spyOn(AuditLog, 'create').mockRejectedValue(new Error('Injected audit failure') as never)
    try {
      await expect(adminRepository.mutateUser(actorId, id, 'ban', { expectedVersion: 0, reason }, 'audit-fail', 0)).rejects.toThrow('Injected audit failure')
      await expect(adminRepository.updateConfig(actorId, { expectedVersion: 0, reason, siteName: 'changed', description: '', announcement: '' }, 'config-fail', 0)).rejects.toThrow('Injected audit failure')
    } finally { spy.mockRestore() }
    expect((await User.findById(id))?.isLocked).toBe(false)
    expect((await User.findById(id))?.adminVersion).toBe(0)
    expect(await SiteConfig.countDocuments()).toBe(0)
  })
  it('author approval/revoke transitions affect current authorization, retaining stories', async () => {
    const target = await createUser({ authorStatus: 'pending' }), id = String(target._id)
    const approved = await adminRepository.mutateUser(actorId, id, 'author-status', { expectedVersion: 0, reason, status: 'approved' }, 'approve-author', 0)
    expect(approved).toMatchObject({ role: 'author', authorStatus: 'approved' })
    await Story.create({ title: 'Retained', slug: 'retained', description: 'Story', authorId: id })
    await adminRepository.mutateUser(actorId, id, 'author-status', { expectedVersion: 1, reason, status: 'revoked' }, 'revoke-author', 0)
    expect(await Story.countDocuments({ authorId: id })).toBe(1)
    expect((await User.findById(id))?.role).toBe('user')
  })
  it('versioned configuration is effective via safe public projection and rejects secret/HTML fields', async () => {
    const input = { expectedVersion: 0, reason, siteName: 'Test site', description: 'Description', announcement: 'Announcement' }
    const results = await Promise.all([request('/admin/config', actorToken, 'PUT', input), request('/admin/config', actorToken, 'PUT', { ...input, siteName: 'Other' })])
    expect(results.map(result => result.status).sort()).toEqual([200, 409])
    expect(await AuditLog.countDocuments({ action: 'config' })).toBe(1)
    const publicResult = await request('/site-config', null)
    expect(Object.keys(publicResult.body.data).sort()).toEqual(['announcement', 'description', 'siteName', 'version'])
    expect((await request('/admin/config', actorToken, 'PUT', { ...input, expectedVersion: 1, JWT_PRIVATE_KEY: 'secret' })).status).toBe(400)
    expect((await request('/admin/config', actorToken, 'PUT', { ...input, expectedVersion: 1, announcement: '<script>alert(1)</script>' })).status).toBe(400)
  })
  it('overview matches independent database filters and hourly views contain real gaps without fake backfill', async () => {
    const active = await createUser({ role: 'author', authorStatus: 'approved' })
    await createUser({ role: 'author', authorStatus: 'approved', isLocked: true })
    const visible = await Story.create({ title: 'Visible', slug: 'visible', description: 'Text', authorId: active._id, moderationStatus: 'approved', contentWarning: 'mature18+', viewCount: 10 })
    const hidden = await Story.create({ title: 'Hidden', slug: 'hidden', description: 'Text', authorId: active._id, moderationStatus: 'hidden' })
    await Story.create({ title: 'Pending', slug: 'pending', description: 'Text', authorId: active._id })
    await Chapter.create([{ storyId: visible._id, title: 'Public', slug: 'public', order: 1, contentHtml: '<p>SECRET BODY</p>', status: 'published', moderationStatus: 'approved', viewCount: 10 }, { storyId: visible._id, title: 'Pending', slug: 'pending', order: 2, contentHtml: '<p>text</p>', status: 'published', moderationStatus: 'pending', viewCount: 3 }, { storyId: hidden._id, title: 'Hidden parent', slug: 'hidden', order: 1, contentHtml: '<p>text</p>', status: 'published', moderationStatus: 'approved', viewCount: 2 }])
    await Report.create({ reporterId: actorId, targetId: visible._id, targetType: 'story', reason: 'spam', status: 'in_progress' })
    const overview = (await request('/admin/dashboard/overview')).body.data
    expect(overview.kpis).toEqual({ users: 3, authors: 1, stories: 1, publicChapters: 1, pendingStories: 1, pendingChapters: 1, openReports: 1 })
    expect(overview.health).toMatchObject({ mongodb: 'available', redis: 'available' })
    expect(JSON.stringify((await request('/admin/stories')).body)).not.toContain('SECRET BODY')
    await adminRepository.sampleMetrics(new Date('2026-10-12T01:23:00Z'))
    await Chapter.updateMany({}, { $set: { viewCount: 100 } })
    await adminRepository.sampleMetrics(new Date('2026-10-12T01:40:00Z'))
    expect(await AdminMetricSnapshot.countDocuments()).toBe(1)
    const chart = await adminRepository.charts({ metric: 'views', from: '2026-10-11', to: '2026-10-13' })
    expect(chart.points).toEqual([{ date: '2026-10-11', value: null }, { date: '2026-10-12', value: 15 }, { date: '2026-10-13', value: null }])
    expect((await request('/admin/dashboard/charts?metric=users&from=2026-02-30&to=2026-03-01')).status).toBe(400)
  })
  it('audit pagination is read-only, filter bound and redacted', async () => {
    for (let i = 0; i < 3; i++) {
      const user = await createUser()
      await adminRepository.mutateUser(actorId, String(user._id), 'ban', { expectedVersion: 0, reason }, `audit-${i}`, 0)
    }
    const first = await request('/admin/audit-logs?limit=2')
    const second = await request(`/admin/audit-logs?limit=2&cursor=${first.body.meta.nextCursor}`)
    expect(new Set([...first.body.data, ...second.body.data].map((row: { _id: string }) => row._id)).size).toBe(3)
    expect((await request(`/admin/audit-logs?action=role&cursor=${first.body.meta.nextCursor}`)).status).toBe(400)
    expect((await request('/admin/audit-logs', actorToken, 'DELETE')).status).not.toBe(200)
  })
  it('backup remains unconfigured and quotas never disappear during a Redis outage', async () => {
    expect((await request('/admin/backups')).body.data).toMatchObject({ status: 'NOT_CONFIGURED', items: [] })
    expect((await request('/admin/backups', actorToken, 'POST', { reason, acknowledgeNonSnapshot: true })).body.code).toBe('BACKUP_NOT_CONFIGURED')
    const spy = vi.spyOn(redis, 'eval').mockRejectedValue(new Error('Injected Redis outage'))
    try { expect((await request('/admin/users')).body.code).toBe('RATE_LIMIT_UNAVAILABLE') } finally { spy.mockRestore() }
  })
  it('backup queue serializes duplicate requests, checks actor epoch and rolls back on audit failure', async () => {
    await expect(backupRepository.enqueue(actorId, 1, reason, 'stale')).rejects.toMatchObject({ code: 'ADMIN_PERMISSION_CHANGED' })
    const spy = vi.spyOn(AuditLog, 'create').mockRejectedValue(new Error('Injected backup audit failure') as never)
    try { await expect(backupRepository.enqueue(actorId, 0, reason, 'audit-fail')).rejects.toThrow('Injected backup audit failure') } finally { spy.mockRestore() }
    expect(await BackupJob.countDocuments()).toBe(0)
    const results = await Promise.allSettled([backupRepository.enqueue(actorId, 0, reason, 'queue-a'), backupRepository.enqueue(actorId, 0, reason, 'queue-b')])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(await BackupJob.countDocuments({ active: true })).toBe(1)
    expect(await AuditLog.countDocuments({ action: 'backup' })).toBe(1)
    const page = await backupRepository.list({ limit: 20 })
    expect(JSON.stringify(page)).not.toMatch(/leaseOwner|artifactKey|password|URI/)
    expect(page.items[0].status).toBe('queued')
    await expect(backupRepository.list({ limit: 20, cursor: 'bad' })).rejects.toMatchObject({ code: 'INVALID_CURSOR' })
  })
  it('expired leases recover as failed and old owners cannot heartbeat or publish success', async () => {
    const job = await backupRepository.enqueue(actorId, 0, reason, 'recover')
    const owner = randomUUID()
    expect(await backupRepository.claim(owner)).not.toBeNull()
    expect(await backupRepository.claim(randomUUID())).toBeNull()
    await BackupJob.updateOne({ _id: job.id }, { $set: { leaseUntil: new Date(Date.now() - 1000) } })
    expect(await backupRepository.heartbeat(job.id, owner)).toBe(false)
    expect(await backupRepository.finish(job.id, owner, { artifactKey: 'old', sizeBytes: 100, sha256: 'bad' })).toBe(false)
    await backupRepository.recover()
    expect(await BackupJob.findById(job.id).lean()).toMatchObject({ status: 'failed', active: false, errorCode: 'WORKER_INTERRUPTED' })
    await expect(backupRepository.enqueue(actorId, 0, reason, 'new')).resolves.toMatchObject({ status: 'queued' })
  })
  it('writes AES archive using actual Mongo tools and restores verified data/indexes only to a new test database', async () => {
    const directory = await mkdtemp(path.resolve('node_modules/backup-integration-'))
    const restoreDatabase = `novel_backup_restore_test_${randomUUID().replaceAll('-', '')}`
    const restoreConnection = mongoose.createConnection(`mongodb://127.0.0.1:27028/${restoreDatabase}?directConnection=true&replicaSet=rs0`, { serverSelectionTimeoutMS: 5000 })
    await restoreConnection.asPromise()
    const key = randomBytes(32)
    const dumpToolConfig = `/tmp/codex-phase9-dump-${randomUUID()}.json`, restoreToolConfig = `/tmp/codex-phase9-restore-${randomUUID()}.json`
    async function writeToolsConfig(file: string, uri: string) {
      await new Promise<void>((resolve, reject) => {
        // Fixed shell program; the owned path is a positional argument and JSON travels through stdin.
        const child = spawn('docker', ['exec', '-i', testMongoContainer, 'sh', '-c', 'umask 077\ncat > "$1"', 'codex', file], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true, timeout: 5000 })
        child.stderr.resume(); child.once('error', reject); child.stdin.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(new Error('Test tool config creation failed'))); child.stdin.end(JSON.stringify({ uri }))
      })
    }
    await writeToolsConfig(dumpToolConfig, `mongodb://127.0.0.1:27017/${database}?directConnection=true`)
    const run: ToolRunner = (args, signal) => spawn('docker', ['exec', testMongoContainer, 'mongodump', ...args.map(arg => arg.startsWith('--config=') ? '--config=' + dumpToolConfig : arg)], { signal, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
    const adapter = createLocalBackupAdapter({ directory, key, mongoConfigFile: 'INJECTED_TEST_ONLY', database, timeoutMs: 30000, maxBytes: 10 * 1024 * 1024, totalBytes: 50 * 1024 * 1024 }, run)
    const worker = createBackupWorker(async () => adapter)
    try {
      const story = await Story.create({ title: 'Backup truyện', slug: 'backup-story', description: 'Fixture', authorId: actorId, moderationStatus: 'approved' })
      await Chapter.create({ storyId: story._id, title: 'Backup chương', slug: 'backup-chapter', order: 1, contentHtml: '<p>Nội dung tiếng Việt 👋</p>', status: 'published', moderationStatus: 'approved' })
      const job = await backupRepository.enqueue(actorId, 0, reason, 'real-backup')
      await adapter.check()
      await Promise.all([worker.tick(), worker.tick()])
      const complete = await BackupJob.findById(job.id).lean()
      expect(complete).toMatchObject({ status: 'succeeded', active: false, consistency: 'logical_non_snapshot' })
      expect(await readdir(directory)).toEqual([complete!.artifactKey])
      const file = path.join(directory, complete!.artifactKey!)
      const verified = await verifyEncryptedBackup(file, key, complete!.sha256!)
      expect(verified.sizeBytes).toBe(complete!.sizeBytes)
      if (!restoreDatabase.startsWith('novel_backup_restore_test_') || restoreDatabase === database || await restoreConnection.db!.listCollections().hasNext()) throw new Error('Restore isolation guard')
      const uri = `mongodb://127.0.0.1:27028/${restoreDatabase}?directConnection=true&replicaSet=rs0`, configFile = path.join(directory, 'restore-tools.json')
      await writeFile(configFile, JSON.stringify({ uri }), { mode: 0o600 })
      await writeToolsConfig(restoreToolConfig, `mongodb://127.0.0.1:27017/${restoreDatabase}?directConnection=true`)
      const input = { archive: file, key, sha256: complete!.sha256!, sourceDatabase: database, uri, mongoConfigFile: configFile }
      const restoreRun = (args: string[]) => spawn('docker', ['exec', '-i', testMongoContainer, 'mongorestore', ...args.map(arg => arg.startsWith('--config=') ? '--config=' + restoreToolConfig : arg)], { windowsHide: true, shell: false, stdio: ['pipe', 'ignore', 'pipe'], timeout: 30000 })
      const restored = await restoreToIsolatedDatabase(input, restoreRun)
      expect(restored.database).toBe(restoreDatabase)
      await expect(restoreToIsolatedDatabase(input, restoreRun)).rejects.toMatchObject({ code: 'RESTORE_TARGET_NOT_EMPTY' })
      await expect(restoreToIsolatedDatabase({ ...input, uri: 'mongodb://remote.example/production' }, restoreRun)).rejects.toMatchObject({ code: 'RESTORE_TARGET_REJECTED' })
      await expect(restoreToIsolatedDatabase({ ...input, key: randomBytes(32) }, restoreRun)).rejects.toMatchObject({ code: 'BACKUP_AUTHENTICATION_FAILED' })
      for (const collection of ['users', 'stories', 'chapters', 'auditlogs']) {
        expect(await restoreConnection.db!.collection(collection).countDocuments()).toBe(await mongoose.connection.db!.collection(collection).countDocuments())
        const restoredIndexes = await restoreConnection.db!.collection(collection).indexes(), sourceIndexes = await mongoose.connection.db!.collection(collection).indexes()
        expect(restoredIndexes.sort((a, b) => String(a.name).localeCompare(String(b.name)))).toEqual(sourceIndexes.sort((a, b) => String(a.name).localeCompare(String(b.name))))
      }
      const chapter = await restoreConnection.db!.collection('chapters').findOne()
      expect(chapter?.contentHtml).toBe('<p>Nội dung tiếng Việt 👋</p>')
      expect(String(chapter?.storyId)).toBe(String(story._id))
      const failedTarget = `novel_backup_restore_test_${randomUUID().replaceAll('-', '')}`, failedUri = `mongodb://127.0.0.1:27028/${failedTarget}?directConnection=true&replicaSet=rs0`
      await writeFile(configFile, JSON.stringify({ uri: failedUri }), { mode: 0o600 })
      await expect(restoreToIsolatedDatabase({ ...input, uri: failedUri }, () => spawn(process.execPath, ['-e', 'process.stdin.resume();process.stdin.on("end",()=>{process.exitCode=2})'], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true, timeout: 5000 }))).rejects.toMatchObject({ code: 'RESTORE_TOOL_OR_AUTHENTICATION_FAILED' })
      expect(await restoreConnection.getClient().db(failedTarget).listCollections().hasNext()).toBe(false)
      expect(await restoreConnection.db!.collection('chapters').countDocuments()).toBe(1)
      await writeFile('../phase-9-2026-10-12-backup-verification.json', JSON.stringify({ measuredAt: new Date(), tools: 'Mongo database tools100.19.1 in isolated Mongo8 container', privateJsonConfigAcceptedByDumpAndRestore: true, consistency: 'quiescent fixture / logical_non_snapshot; not live-write production snapshot', state: complete!.status, encryptedBytes: complete!.sizeBytes, sha256: complete!.sha256, authenticatedBeforeRestore: true, restoredCountsAndIndexes: ['users', 'stories', 'chapters', 'auditlogs'], unicodeAndStoryReference: true, actualAppDatabaseTouched: false }, null, 2))
    } finally {
      await worker.stop()
      if (restoreConnection.name === restoreDatabase && restoreDatabase.startsWith('novel_backup_restore_test_')) await restoreConnection.dropDatabase()
      await restoreConnection.close()
      if (!directory.startsWith(path.resolve('node_modules/backup-integration-'))) throw new Error('Archive cleanup guard')
      await rm(directory, { recursive: true, force: true })
    }
  }, 60000)
  it('measures bounded queries on 10k users/1k stories/50k chapters, HTTP with real limiter, and index explain', async () => {
    const author = await createUser({ role: 'author', authorStatus: 'approved' })
    const users = Array.from({ length: 10000 }, (_, i) => ({ username: `load_${i}`, email: `load_${i}@example.test`, displayName: 'Load', role: 'user' }))
    for (let i = 0; i < users.length; i += 1000) await User.insertMany(users.slice(i, i + 1000))
    const stories = await Story.insertMany(Array.from({ length: 1000 }, (_, i) => ({ title: `Load ${i}`, slug: `load-${i}`, description: 'Load', authorId: author._id, moderationStatus: 'approved' })))
    for (let batch = 0; batch < 50; batch++) await Chapter.insertMany(stories.map(story => ({ storyId: story._id, title: `Chapter ${batch + 1}`, slug: `chapter-${batch + 1}`, order: batch + 1, contentHtml: '<p>Load fixture</p>', status: 'published', moderationStatus: 'approved', viewCount: batch })))
    for (let batch = 0; batch < 5; batch++) await AuditLog.insertMany(Array.from({ length: 1000 }, (_, i) => ({ actorId, actorRole: 'admin', action: 'role', targetType: 'user', targetId: `fixture-${batch}-${i}`, before: { role: 'user' }, after: { role: 'moderator' }, reason, requestId: 'load-fixture', createdAt: new Date() })))
    const measures: Record<string, unknown> = {}
    const coldStart = performance.now()
    const coldOverview = await request('/admin/dashboard/overview')
    expect(coldOverview.status).toBe(200)
    measures.coldOverviewMs = performance.now() - coldStart
    for (const path of ['/admin/users?role=user&limit=20', '/admin/dashboard/overview', '/admin/stories?moderationStatus=approved&limit=20', `/admin/audit-logs?actorId=${actorId}&limit=20`]) {
      await request(path)
      const samples: number[] = [], statuses: Record<string, number> = {}
      for (let batch = 0; batch < (path.includes('/stories') || path.includes('/audit-logs') ? 1 : 3); batch++) await Promise.all(Array.from({ length: 10 }, async () => { const started = performance.now(); const result = await request(path); samples.push(performance.now() - started); statuses[result.status] = (statuses[result.status] ?? 0) + 1; expect(result.status).toBe(200) }))
      samples.sort((a, b) => a - b)
      measures[path] = { concurrency: 10, samples: samples.length, p50: samples[Math.floor(samples.length * .5)], p95: samples[Math.ceil(samples.length * .95) - 1], p99: samples.at(-1), statuses }
    }
    const explain = await User.find({ role: 'user' }).sort({ createdAt: -1, _id: -1 }).limit(21).select('_id username').explain('executionStats') as unknown as { executionStats: { nReturned: number; totalDocsExamined: number } }
    expect(explain.executionStats.nReturned).toBe(21)
    expect(explain.executionStats.totalDocsExamined).toBeLessThanOrEqual(30)
    const storyOld = await Story.find({ moderationStatus: 'approved' }).sort({ createdAt: -1, _id: -1 }).limit(21).hint({ createdAt: -1 }).select('_id title').explain('executionStats') as unknown as { executionStats: Record<string, unknown> }
    const storyPlan = await Story.find({ moderationStatus: 'approved' }).sort({ createdAt: -1, _id: -1 }).limit(21).select('_id title').explain('executionStats') as unknown as { executionStats: { nReturned: number; totalDocsExamined: number } }
    const auditPlan = await AuditLog.find({ actorId }).sort({ createdAt: -1, _id: -1 }).limit(21).select('_id action reason').explain('executionStats') as unknown as { executionStats: { nReturned: number; totalDocsExamined: number } }
    expect(storyPlan.executionStats.totalDocsExamined).toBeLessThanOrEqual(30)
    expect(auditPlan.executionStats.totalDocsExamined).toBeLessThanOrEqual(30)
    const baseline = await request('/admin/dashboard/overview')
    expect(baseline.body.data.kpis).toMatchObject({ users: 10002, authors: 1, stories: 1000, publicChapters: 50000 })
    await writeFile('../phase-9-2026-10-12-benchmark.json', JSON.stringify({ measuredAt: new Date(), environment: 'isolated local Mongo8 replica set / Redis7 / HTTP actual quotas; not staging SLA', fixtures: { users: 10002, stories: 1000, chapters: 50000, auditLogs: 5000 }, measures, userExplain: explain.executionStats, storyOldIndexExplain: storyOld.executionStats, storyExplain: storyPlan.executionStats, auditExplain: auditPlan.executionStats }, null, 2))
  }, 180000)
})
