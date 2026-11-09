import { randomUUID } from 'node:crypto'
import http from 'node:http'
import mongoose, { Types } from 'mongoose'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
vi.mock('../config/env.js', async () => {
  const { generateKeyPairSync } = await import('node:crypto')
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  return { env: { NODE_ENV: 'test', LOG_LEVEL: 'error', JWT_PRIVATE_KEY: keys.privateKey, JWT_PUBLIC_KEY: keys.publicKey,
    CLIENT_URL: 'http://localhost:5173', PUBLIC_SITE_URL: 'https://example.test', SEO_INDEXABLE: false,
    REDIS_HOST: '127.0.0.1', REDIS_PORT: 6389, REDIS_PASSWORD: '', TRUST_PROXY: '', GOOGLE_CLIENT_ID: '', CRAWLER_SOURCES_JSON: '[]', SMTP_HOST: '' } }
})
vi.mock('../emails/mailer.js', () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendEmail: vi.fn() }))
import app from '../app.js'
import { redis } from '../config/redis.js'
import { User } from '../models/User.model.js'
import { Story } from '../models/Story.model.js'
import { Chapter } from '../models/Chapter.model.js'
import { Tag } from '../models/Tag.model.js'
import { Review } from '../models/Review.model.js'
import { Comment } from '../models/Comment.model.js'
import { Report } from '../models/Report.model.js'
import { Genre } from '../models/Genre.model.js'
import { signAccessToken, signRefreshToken } from '../common/jwt.js'
import { hashPassword, comparePassword } from '../common/hash.js'
import { registerSchema, resetPasswordSchema } from '../modules/auth/auth.validation.js'
import { changePasswordSchema } from '../modules/users/users.validation.js'
import { createStorySchema, updateStorySchema } from '../modules/stories/stories.validation.js'

const enabled = process.env.RUN_SECURITY_INTEGRATION === '1'
const database = `novel_security_test_${randomUUID().replaceAll('-', '')}`
let server: http.Server, origin: string
const ids: Record<string, string> = {}
const token = (role: string) => signAccessToken({ id: ids[role], authVersion: 0 })
const call = (path: string, role?: string, body?: unknown, method = body ? 'POST' : 'GET') => fetch(origin + '/api/v1' + path, {
  method, headers: { ...(role ? { Authorization: `Bearer ${token(role)}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
})
const story = (authorId = ids.author, extra = {}) => Story.create({ title: 'Security fixture', slug: randomUUID(), description: 'Isolated security fixture', authorId, moderationStatus: 'approved', ...extra })

describe.skipIf(!enabled)('security assessment: real isolated HTTP/Mongo/Redis', () => {
  beforeAll(async () => {
    await mongoose.connect(`mongodb://127.0.0.1:27028/${database}?directConnection=true&replicaSet=rs0`, { serverSelectionTimeoutMS: 5000 })
    await redis.connect()
    await Promise.all([User.init(), Story.init(), Chapter.init(), Tag.init(), Review.init(), Comment.init(), Report.init(), Genre.init()])
    for (const role of ['user', 'author', 'moderator', 'admin']) ids[role] = String((await User.create({ email: `${role}@example.test`, username: role, displayName: role, role, authorStatus: role === 'author' ? 'approved' : undefined }))._id)
    server = http.createServer(app)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`
  }, 20000)
  afterAll(async () => {
    if (server?.listening) await new Promise<void>(resolve => server.close(() => resolve()))
    if (mongoose.connection.name === database && database.startsWith('novel_security_test_')) await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
    if (redis.status === 'ready') await redis.quit(); else redis.disconnect()
  })

  it('SECURITY-002: tag search treats metacharacters literally', async () => {
    await Tag.create([{ name: 'plain', slug: 'plain' }, { name: 'literal.*', slug: 'literal' }])
    const res = await call('/tags?q=' + encodeURIComponent('.*'))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { data: { name: string }[] }).data.map(t => t.name)).toEqual(['literal.*'])
  })
  it('SECURITY-002: malformed regex is harmless text, not HTTP 500', async () => {
    expect((await call('/tags?q=' + encodeURIComponent('['))).status).toBe(200)
  })
  it('SECURITY-003: refuses new passwords that bcrypt would truncate, including Unicode', () => {
    for (const password of ['a'.repeat(72) + 'suffix', '😀'.repeat(19)]) {
      expect(registerSchema.safeParse({ email: 'a@example.test', username: 'test', password }).success).toBe(false)
      expect(resetPasswordSchema.safeParse({ token: 'test', newPassword: password }).success).toBe(false)
      expect(changePasswordSchema.safeParse({ oldPassword: 'old', newPassword: password }).success).toBe(false)
    }
    expect(registerSchema.safeParse({ email: 'a@example.test', username: 'test', password: '😀'.repeat(18) }).success).toBe(true)
  })
  it('SECURITY-003: password hashing itself refuses silent truncation', async () => {
    await expect(hashPassword('a'.repeat(72) + 'suffix')).rejects.toMatchObject({ code: 'PASSWORD_TOO_LONG' })
    const hash = await hashPassword('safe-password')
    expect(await comparePassword('safe-password', hash)).toBe(true)
    expect(await comparePassword('different-password', hash)).toBe(false)
  })
  it('SECURITY-004: one story visitor cannot add multiple views by replaying GET', async () => {
    const s = await story()
    for (let i = 0; i < 3; i++) expect((await call(`/stories/${s.slug}`)).status).toBe(200)
    await expect.poll(async () => (await Story.findById(s._id))!.viewCount).toBe(1)
  })
  it('SECURITY-004: chapter view replay deduplicates both chapter and story counts', async () => {
    const s = await story()
    const c = await Chapter.create({ storyId: s._id, title: 'Fixture', slug: 'one', order: 1, contentHtml: '<p>Text</p>', status: 'published', moderationStatus: 'approved' })
    for (let i = 0; i < 3; i++) expect((await call(`/stories/${s.slug}/chapters/${c.slug}`)).status).toBe(200)
    await expect.poll(async () => (await Chapter.findById(c._id))!.viewCount).toBe(1)
    expect((await Story.findById(s._id))!.viewCount).toBe(1)
  })
  it('SECURITY-005: bounds tag fan-out before database work', () => {
    const input = { title: 'Fixture title', description: 'Fixture description', genreIds: [new Types.ObjectId().toString()], tags: Array.from({ length: 51 }, (_, i) => `tag-${i}`) }
    expect(createStorySchema.safeParse(input).success).toBe(false)
    expect(updateStorySchema.safeParse({ tags: input.tags }).success).toBe(false)
    expect(createStorySchema.safeParse({ ...input, tags: ['a'.repeat(101)] }).success).toBe(false)
  })
  it('SECURITY-005: oversized HTTP tag list is rejected without persistent writes', async () => {
    const genre = await Genre.create({ name: 'Fixture genre', slug: 'fixture-genre' })
    const count = await Tag.countDocuments()
    const res = await call('/stories', 'author', { title: 'Fan out', description: 'Isolated test only', genreIds: [String(genre._id)], tags: Array.from({ length: 51 }, (_, i) => `fanout-${i}`) })
    expect(res.status).toBe(400)
    expect(await Tag.countDocuments()).toBe(count)
  })
  it('SECURITY-004: concurrent reads and forged forwarding headers cannot multiply views', async () => {
    const s = await story()
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => fetch(origin + `/api/v1/stories/${s.slug}`, { headers: { 'X-Forwarded-For': `192.0.2.${i + 1}` } })))
    expect(results.every(r => r.status === 200)).toBe(true)
    expect((await Story.findById(s._id))!.viewCount).toBe(1)
  })
  it('SECURITY-005: story write quota is per authenticated actor and blocks the eleventh write', async () => {
    const s = await story()
    for (let i = 0; i < 10; i++) expect((await call(`/stories/${s._id}`, 'author', { description: `Fixture update ${i}` }, 'PATCH')).status).toBe(200)
    expect((await call(`/stories/${s._id}`, 'author', { description: 'Over quota update' }, 'PATCH')).status).toBe(429)
    expect((await call(`/stories/${s._id}`, 'admin', { description: 'Another actor update' }, 'PATCH')).status).toBe(200)
  })
  it('BUG-001: author query really filters stories', async () => {
    const first = await story()
    await story(ids.admin)
    const res = await call(`/stories?author=${ids.author}&limit=100`)
    const data = ((await res.json()) as { data: { _id: string; authorId: { _id: string } }[] }).data
    expect(data.some((s: { _id: string }) => s._id === String(first._id))).toBe(true)
    expect(data.every((s: { authorId: { _id: string } }) => s.authorId._id === ids.author)).toBe(true)
  })
  it('BUG-002: a populated author cannot report their own story', async () => {
    const s = await story()
    const res = await call('/reports', 'author', { targetType: 'story', targetId: String(s._id), reason: 'other' })
    expect(res.status).toBe(400)
    expect(await Report.countDocuments({ targetId: s._id })).toBe(0)
  })
  it('BUG-003: authenticated review/comment lists preserve likedByMe', async () => {
    const s = await story()
    await Review.create({ storyId: s._id, userId: ids.author, content: 'A'.repeat(60), likedUserIds: [ids.user], likeCount: 1 })
    await Comment.create({ storyId: s._id, userId: ids.author, content: 'Fixture', likedUserIds: [ids.user], likeCount: 1 })
    for (const path of [`/stories/${s._id}/reviews`, `/comments?storyId=${s._id}`]) {
      const res = await call(path, 'user')
      const data = ((await res.json()) as { data: { likedByMe: boolean; likedUserIds?: string[] }[] }).data
      expect(data[0].likedByMe).toBe(true)
      expect(data[0].likedUserIds).toBeUndefined()
      expect(((await (await call(path)).json()) as { data: { likedByMe: boolean }[] }).data[0].likedByMe).toBe(false)
    }
  })
  it.each(['guest', 'user', 'author', 'moderator', 'admin'])('RBAC: %s has the expected admin boundary', async role => {
    const res = await call('/admin/users?limit=1', role === 'guest' ? undefined : role)
    expect(res.status).toBe(role === 'guest' ? 401 : role === 'admin' ? 200 : 403)
  })
  it('ownership, hidden content, mass assignment and JWT purpose boundaries hold', async () => {
    const s = await story(ids.admin, { moderationStatus: 'pending' })
    expect((await call(`/stories/${s.slug}`)).status).toBe(404)
    expect((await call(`/stories/by-id/${s._id}`, 'author')).status).toBe(403)
    expect((await call(`/stories/${s._id}`, 'author', { title: 'Stolen title' }, 'PATCH')).status).toBe(403)
    expect((await call('/users/me', 'user', { role: 'admin', isEmailVerified: true, bio: 'Hello' }, 'PATCH')).status).toBe(200)
    expect((await User.findById(ids.user))!.role).toBe('user')
    expect((await User.findById(ids.user))!.isEmailVerified).toBe(false)
    const res = await fetch(origin + '/api/v1/users/me', { headers: { Authorization: `Bearer ${signRefreshToken({ id: ids.admin, authVersion: 0 })}` } })
    expect(res.status).toBe(401)
  })
})
