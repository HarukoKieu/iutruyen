import { randomUUID, createHash } from 'node:crypto'
import http from 'node:http'
import mongoose, { Types } from 'mongoose'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
vi.mock('../config/env.js', async () => {
  const { generateKeyPairSync } = await import('node:crypto')
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  return { env: { NODE_ENV: 'test', LOG_LEVEL: 'error', JWT_PRIVATE_KEY: keys.privateKey, JWT_PUBLIC_KEY: keys.publicKey,
    CLIENT_URL: 'http://localhost:5173', PUBLIC_SITE_URL: 'https://example.test', SEO_INDEXABLE: false,
    REDIS_HOST: '127.0.0.1', REDIS_PORT: 6389, REDIS_PASSWORD: '', TRUST_PROXY: '', GOOGLE_CLIENT_ID: '', CRAWLER_SOURCES_JSON: '[]', SMTP_HOST: '' } }
})
vi.mock('../emails/mailer.js', () => ({ sendVerificationEmail: vi.fn(async () => true), sendPasswordResetEmail: vi.fn(async () => true), sendEmail: vi.fn(async () => true) }))
import app from '../app.js'
import { redis } from '../config/redis.js'
import { User } from '../models/User.model.js'
import { Story } from '../models/Story.model.js'
import { Chapter } from '../models/Chapter.model.js'
import { Comment } from '../models/Comment.model.js'
import { Review } from '../models/Review.model.js'
import { Notification } from '../models/Notification.model.js'
import { Report } from '../models/Report.model.js'
import { ModerationLog } from '../models/ModerationLog.model.js'
import { chapterRepository } from '../repositories/chapter.repository.js'
import { commentRepository } from '../repositories/comment.repository.js'
import { reviewRepository } from '../repositories/review.repository.js'
import { notificationRepository } from '../repositories/notification.repository.js'
import { moderationService } from '../modules/moderation/moderation.service.js'
import { ratingsReviewsService } from '../modules/ratings-reviews/ratings-reviews.service.js'
import { commentsService } from '../modules/comments/comments.service.js'
import { resetPassword, refresh, createSession, logout } from '../modules/auth/auth.service.js'
import { signPasswordResetToken, signAccessToken, signRefreshToken, verifyToken, type TokenPayload } from '../common/jwt.js'
import { hashPassword } from '../common/hash.js'
import { readingHistoryRepository } from '../repositories/reading-history.repository.js'
import { ReadingHistory } from '../models/ReadingHistory.model.js'
import { Follow } from '../models/Follow.model.js'

const enabled = process.env.RUN_REMEDIATION_INTEGRATION === '1'
const database = `novel_remediation_test_${randomUUID().replaceAll('-', '')}`
let author: Types.ObjectId, moderator: Types.ObjectId, other: Types.ObjectId
let server: http.Server, origin = ''
describe.skipIf(!enabled)('audit fixes on isolated MongoDB replica set / Redis / HTTP', () => {
  beforeAll(async () => {
    await mongoose.connect(`mongodb://127.0.0.1:27028/${database}?directConnection=true&replicaSet=rs0`, { serverSelectionTimeoutMS: 5000 })
    await redis.connect()
    await Promise.all([User.init(), Story.init(), Chapter.init(), Comment.init(), Review.init(), Notification.init(), Report.init(), ModerationLog.init()])
    const makeUser = (name: string, role: string) => User.create({ email: `${name}@example.test`, username: name, displayName: name, role, authorStatus: role === 'author' ? 'approved' : undefined })
    author = (await makeUser('author', 'author'))._id
    moderator = (await makeUser('moderator', 'moderator'))._id
    other = (await makeUser('reader', 'user'))._id
    server = http.createServer(app)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`
  }, 20000)
  afterAll(async () => {
    if (server?.listening) await new Promise<void>(resolve => server.close(() => resolve()))
    if (mongoose.connection.name === database && database.startsWith('novel_remediation_test_')) await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
    if (redis.status === 'ready') await redis.quit(); else redis.disconnect()
  })
  const story = () => Story.create({ title: 'Truyện thử nghiệm', slug: randomUUID(), description: 'Nội dung thử nghiệm biệt lập', authorId: author, moderationStatus: 'approved' })

  it('only one real database reset wins and old HTTP/refresh tokens are revoked', async () => {
    const user = await User.create({ email: 'reset@example.test', username: 'reset', displayName: 'Reset', password: await hashPassword('Old123!') })
    const payload = { id: String(user._id), email: user.email, authVersion: 0 }
    const token = signPasswordResetToken(payload), access = signAccessToken(payload), oldRefresh = signRefreshToken(payload)
    const results = await Promise.allSettled(['One123!', 'Two123!'].map(newPassword => resetPassword({ token, newPassword })))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((await User.findById(user._id))!.authVersion).toBe(1)
    expect((await fetch(`${origin}/api/v1/users/me`, { headers: { Authorization: `Bearer ${access}` } })).status).toBe(401)
    await expect(refresh(oldRefresh)).rejects.toMatchObject({ code: 'TOKEN_REVOKED' })
    await expect(resetPassword({ token, newPassword: 'Replay123!' })).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
  })
  it('follow errors return through Express and the next request is served', async () => {
    const headers = { Authorization: `Bearer ${signAccessToken({ id: String(other), authVersion: 0 })}` }
    expect((await fetch(`${origin}/api/v1/stories/not-an-id/follow`, { method: 'POST', headers })).status).toBe(400)
    expect((await fetch(`${origin}/api/v1/stories/${new Types.ObjectId()}/follow`, { method: 'POST', headers })).status).toBe(404)
    expect((await fetch(`${origin}/api/v1/users/me`, { headers })).status).toBe(200)
  })
  it('chapter create/update/delete and moderator/report transitions commit matching counts', async () => {
    const s = await story()
    const chapter = await chapterRepository.create({ storyId: s._id, title: '😀'.repeat(100), slug: 'first', order: 1, contentHtml: '<p>Content</p>', status: 'published', moderationStatus: 'pending' })
    await moderationService.moderateChapter(String(moderator), String(chapter._id), 'approve', { notifyUser: true })
    expect((await Story.findById(s._id))!.chapterCount).toBe(1)
    const notification = await Notification.findOne({ userId: author })
    expect(notification!.title.length).toBeLessThanOrEqual(150)
    const report = await Report.create({ reporterId: other, targetType: 'chapter', targetId: chapter._id, reason: 'other', description: 'Nội dung cần kiểm tra' })
    await moderationService.actionReport(String(moderator), String(report._id), { action: 'hide', notifyUser: false })
    expect((await Story.findById(s._id))!.chapterCount).toBe(0)
    await chapterRepository.updateById(chapter._id, { moderationStatus: 'approved' })
    expect((await Story.findById(s._id))!.chapterCount).toBe(1)
    await chapterRepository.deleteById(chapter._id)
    expect((await Story.findById(s._id))!.chapterCount).toBe(0)
  })
  it('story comments exclude chapter comments; hide differs from author locking', async () => {
    const s = await story()
    const root = await commentRepository.create({ storyId: s._id, userId: other, content: 'Bình luận cấp truyện' })
    await commentRepository.create({ storyId: s._id, chapterId: new Types.ObjectId(), userId: other, content: 'Bình luận chương ẩn' })
    expect((await commentRepository.findManyPaginated({ storyId: s._id })).items.map(c => String(c._id))).toEqual([String(root._id)])
    await commentsService.toggleLock(String(root._id), String(author), 'author', 'approved')
    expect((await commentRepository.findManyPaginated({ storyId: s._id })).items).toHaveLength(1)
    await moderationService.moderateComment(String(moderator), String(root._id), 'hide', { notifyUser: false })
    expect((await commentRepository.findManyPaginated({ storyId: s._id })).items).toHaveLength(0)
    await expect(commentsService.getReplies(String(root._id), { limit: 10 })).rejects.toMatchObject({ statusCode: 404 })
    await moderationService.moderateComment(String(moderator), String(root._id), 'approve', { notifyUser: false })
    expect((await commentRepository.findManyPaginated({ storyId: s._id })).items).toHaveLength(1)
    await expect(commentsService.toggleLock(String(root._id), String(author), 'user', 'revoked')).rejects.toMatchObject({ statusCode: 403 })
    await expect(commentsService.deleteComment(String(root._id), String(author), 'author', 'revoked')).rejects.toMatchObject({ statusCode: 403 })
  })
  it('concurrent replies, repeated deletion and moderation keep replyCount exact with only two previews', async () => {
    const s = await story()
    const root = await commentRepository.create({ storyId: s._id, userId: author, content: 'Root comment' })
    const replies = await Promise.all(Array.from({ length: 8 }, (_, n) => commentRepository.create({ storyId: s._id, parentId: root._id, userId: other, content: `Reply ${n}` })))
    expect((await Comment.findById(root._id))!.replyCount).toBe(8)
    expect((await commentRepository.findManyPaginated({ storyId: s._id })).items[0].previewReplies).toHaveLength(2)
    await Promise.all([commentRepository.softDelete(replies[0]._id, other), commentRepository.softDelete(replies[0]._id, other)])
    expect((await Comment.findById(root._id))!.replyCount).toBe(7)
    await moderationService.moderateComment(String(moderator), String(replies[1]._id), 'hide', { notifyUser: false })
    expect((await Comment.findById(root._id))!.replyCount).toBe(6)
    await moderationService.moderateComment(String(moderator), String(replies[1]._id), 'approve', { notifyUser: false })
    expect((await Comment.findById(root._id))!.replyCount).toBe(7)
  })
  it('review moderator deletion, restore and concurrent likes preserve one identity and exact count', async () => {
    const s = await story()
    const { review } = await reviewRepository.upsert(s._id, other, 'Một bài cảm nhận đủ dài để kiểm tra. '.repeat(2))
    await ratingsReviewsService.deleteReview(String(review._id), String(moderator), 'moderator')
    expect((await Review.findById(review._id))!.isDeleted).toBe(true)
    const restored = await reviewRepository.upsert(s._id, other, 'Bài cảm nhận được cập nhật sau khi xóa. '.repeat(2))
    expect(String(restored.review._id)).toBe(String(review._id))
    const actors = Array.from({ length: 12 }, () => new Types.ObjectId())
    await Promise.all(actors.map(id => reviewRepository.toggleLike(review._id, id)))
    const current = (await Review.findById(review._id))!
    expect(current.likeCount).toBe(12)
    expect(current.likedUserIds).toHaveLength(12)
  })
  it('notification pagination returns every row once across overflow boundaries', async () => {
    const recipient = new Types.ObjectId()
    await notificationRepository.createMany(Array.from({ length: 5 }, (_, n) => ({ userId: recipient, type: 'system', title: `Notification ${n}`, message: 'test' })))
    let cursor: string | undefined, ids: string[] = []
    do {
      const page = await notificationRepository.findByUserId(recipient, { limit: 2, cursor })
      ids.push(...page.notifications.map(n => String(n._id)))
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
  })
  it('reading history preserves same-chapter progress but resets progress on chapter change', async () => {
    await ReadingHistory.init()
    const s = await story(), chapter = new Types.ObjectId(), next = new Types.ObjectId()
    await readingHistoryRepository.upsert(other, s._id, chapter, 70)
    expect((await readingHistoryRepository.upsert(other, s._id, chapter)).scrollPositionPercent).toBe(70)
    expect((await readingHistoryRepository.upsert(other, s._id, next)).scrollPositionPercent).toBe(0)
    expect((await ReadingHistory.findOne({ userId: other, storyId: s._id }))!.lastChapterId).toEqual(next)
  })
  it('rotates refresh tokens atomically, tolerates concurrent retries and revokes the family on late reuse', async () => {
    const session = await createSession({ id: String(other), authVersion: 0 })
    const [first, parallel] = await Promise.all([refresh(session.refreshToken), refresh(session.refreshToken)])
    expect(first.refreshToken).toBe(parallel.refreshToken)
    expect(first.refreshToken).not.toBe(session.refreshToken)
    const payload = verifyToken<TokenPayload>(session.refreshToken, undefined, true)
    const familyKey = `session:family:{${other}:${payload.fid}}`
    // Expire only this test token's retry marker to exercise the post-grace branch without waiting.
    await redis.del(`${familyKey}:retry:${createHash('sha256').update(session.refreshToken).digest('hex')}`)
    await expect(refresh(session.refreshToken)).rejects.toMatchObject({ code: 'TOKEN_REVOKED' })
    await expect(refresh(first.refreshToken)).rejects.toMatchObject({ code: 'TOKEN_REVOKED' })
    const nextSession = await createSession({ id: String(other), authVersion: 0 })
    const next = await refresh(nextSession.refreshToken)
    await logout(String(other), nextSession.refreshToken)
    await expect(refresh(next.refreshToken)).rejects.toMatchObject({ code: 'TOKEN_REVOKED' })
  })
  it('bounds personal lists and traverses identical timestamps without dropping rows', async () => {
    await Follow.init()
    const s = await story()
    const owner = new Types.ObjectId()
    await User.create({ _id: owner, email: 'pages@example.test', username: 'pages', displayName: 'Pages' })
    // Distinct stories preserve the unique user/story constraint.
    const stories = await Promise.all(Array.from({ length: 4 }, () => story()))
    const timestamp = new Date('2026-01-01')
    await Follow.insertMany([s, ...stories].map(row => ({ userId: owner, storyId: row._id, createdAt: timestamp })))
    const headers = { Authorization: `Bearer ${signAccessToken({ id: String(owner), authVersion: 0 })}` }
    for (const endpoint of ['users/me/following', 'bookmarks/me', 'reading-history/me']) {
      expect((await fetch(`${origin}/api/v1/${endpoint}?limit=0`, { headers })).status).toBe(400)
      expect((await fetch(`${origin}/api/v1/${endpoint}?limit=100000`, { headers })).status).toBe(400)
    }
    let cursor: string | null = null
    const ids: string[] = []
    do {
      const response = await fetch(`${origin}/api/v1/users/me/following?limit=2${cursor ? `&cursor=${cursor}` : ''}`, { headers })
      expect(response.status).toBe(200)
      const page = await response.json() as { data: { _id: string }[]; meta: { nextCursor: string | null } }
      ids.push(...page.data.map(item => item._id))
      cursor = page.meta.nextCursor
    } while (cursor)
    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
  })
  it('catalog sends small cover URLs and the cover endpoint rechecks live visibility', async () => {
    const s = await story()
    const bytes = Buffer.alloc(256 * 1024)
    Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes)
    bytes.write('IHDR', 12, 'ascii')
    await Story.updateOne({ _id: s._id }, { coverUrl: `data:image/png;base64,${bytes.toString('base64')}`, contentWarning: 'mature18+' })
    const response = await fetch(`${origin}/api/v1/stories?q=${encodeURIComponent(s.title)}`)
    const text = await response.text()
    expect(response.status).toBe(200)
    expect(text.length).toBeLessThan(50000)
    expect(text).not.toContain('base64')
    expect(text).toContain(`/api/v1/stories/${s._id}/cover`)
    expect((await fetch(`${origin}/api/v1/stories/${s._id}/cover`)).status).toBe(200)
    await Story.updateOne({ _id: s._id }, { moderationStatus: 'hidden' })
    expect((await fetch(`${origin}/api/v1/stories/${s._id}/cover`)).status).toBe(404)
    expect((await fetch(`${origin}/api/v1/stories/ranking?period=week`)).status).toBe(400)
  })
})
