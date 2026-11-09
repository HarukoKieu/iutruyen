import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import app from '../app.js'
vi.mock('../config/env.js', async () => {
  const { generateKeyPairSync } = await import('node:crypto')
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  return { env: { NODE_ENV: 'test', LOG_LEVEL: 'error', JWT_PRIVATE_KEY: keys.privateKey, JWT_PUBLIC_KEY: keys.publicKey,
    PUBLIC_SITE_URL: 'https://example.test', SEO_INDEXABLE: true, SEO_SITEMAP_INTERVAL_MS: 900000, CLIENT_URL: 'http://localhost:5173', REDIS_HOST: '127.0.0.1', REDIS_PORT: 6389, REDIS_PASSWORD: '', TRUST_PROXY: '', CRAWLER_SOURCES_JSON: '[]', GOOGLE_CLIENT_ID: '', SMTP_HOST: '' } }
})
import mongoose, { Types } from 'mongoose'
import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { Story } from '../models/Story.model.js'
import { Chapter } from '../models/Chapter.model.js'
import { User } from '../models/User.model.js'
import { Genre } from '../models/Genre.model.js'
import { Tag } from '../models/Tag.model.js'
import { ModerationLog } from '../models/ModerationLog.model.js'
import { Rating } from '../models/Rating.model.js'
import { storyRepository } from '../repositories/story.repository.js'
import { chapterRepository } from '../repositories/chapter.repository.js'
import { ratingRepository } from '../repositories/rating.repository.js'
import { followRepository } from '../repositories/follow.repository.js'
import { commentRepository } from '../repositories/comment.repository.js'
import { reportRepository } from '../repositories/report.repository.js'
import { Follow } from '../models/Follow.model.js'
import { Comment } from '../models/Comment.model.js'
import { Report } from '../models/Report.model.js'
import { moderationLogRepository } from '../repositories/moderation-log.repository.js'

interface TestSocket {
  once(event: string, handler: (value: unknown) => void): void
  off(event: string, handler: (value: unknown) => void): void
  connect(): void
  disconnect(): void
}
const waitSocketEvent = (socket: TestSocket, event: string, timeout = 5000) => new Promise<unknown>((resolve, reject) => {
  const handler = (value: unknown) => { clearTimeout(timer); resolve(value) }
  const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Socket timeout: ${event}`)) }, timeout)
  socket.once(event, handler)
})

// Opt-in, fixed loopback ports only. Never read application database credentials.
const enabled = process.env.RUN_PHASE_A_INTEGRATION === '1'
const database = `novel_phase_a_test_${randomUUID().replaceAll('-', '')}`
const cache = new Redis({ host: '127.0.0.1', port: 6389, lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null })
let author: Types.ObjectId
describe.skipIf(!enabled)('Phase A: real MongoDB replica set and Redis', () => {
  beforeAll(async () => {
    await mongoose.connect(`mongodb://127.0.0.1:27028/${database}?directConnection=true&replicaSet=rs0`, { serverSelectionTimeoutMS: 5000 })
    await cache.connect()
    await Promise.all([Story.init(), Chapter.init(), Rating.init(), ModerationLog.init(), Follow.init(), Comment.init(), Report.init()])
    const user = await User.create({ email: `${database}@example.test`, username: database.slice(-20), displayName: 'Integration author', provider: 'local' })
    author = user._id
  }, 20000)
  afterAll(async () => {
    if (mongoose.connection.name === database && database.startsWith('novel_phase_a_test_')) await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
    if (cache.status === 'ready') await cache.quit()
    else cache.disconnect()
  })
  const createStory = (slug: string, extra = {}) => Story.create({ title: 'Dragon', slug: `${database}-${slug}`, description: 'Một câu chuyện thử nghiệm', authorId: author, moderationStatus: 'approved', ...extra })

  it('textScore beats views, pages without duplicates and rejects cross-query cursors', async () => {
    const strongest = await createStory('strong', { title: 'Dragon Dragon Dragon', description: 'Dragon Dragon', viewCount: 1 })
    const weaker = await createStory('weak', { title: 'Other', description: 'Dragon', viewCount: 9999 })
    await createStory('hidden', { title: 'Dragon Dragon Dragon', moderationStatus: 'hidden' })
    const first = await storyRepository.searchStories({ q: 'Dragon', sort: 'relevance', limit: 1 })
    expect(String(first.stories[0]._id)).toBe(String(strongest._id))
    expect(first.meta.nextCursor).toBeTruthy()
    const second = await storyRepository.searchStories({ q: 'Dragon', sort: 'relevance', cursor: first.meta.nextCursor, limit: 1 })
    expect(String(second.stories[0]._id)).toBe(String(weaker._id))
    expect(second.meta.hasMore).toBe(false)
    await expect(storyRepository.searchStories({ q: 'Other', sort: 'relevance', cursor: first.meta.nextCursor, limit: 1 })).rejects.toMatchObject({ statusCode: 400 })
    await Story.updateOne({ _id: strongest._id }, { moderationStatus: 'hidden' })
    expect(await storyRepository.findPublicSuggestionsByIds([String(strongest._id)])).toEqual([])
  })

  it('TOC pages filter moderation and preserve reverse order', async () => {
    const story = await createStory('toc')
    await Chapter.create([1, 2, 3, 4, 5].map(order => ({ storyId: story._id, title: `Chương ${order}`, slug: `chapter-${order}`, order, contentHtml: '<p>test chapter</p>', status: 'published', moderationStatus: order === 3 ? 'hidden' : 'approved' })))
    const first = await chapterRepository.findChapterPage(story._id, false, { limit: 2, sort: 'desc' })
    const second = await chapterRepository.findChapterPage(story._id, false, { limit: 2, sort: 'desc', cursor: first.meta.nextCursor! })
    expect([...first.items, ...second.items].map(c => c.order)).toEqual([5, 4, 2, 1])
    expect(second.meta.hasMore).toBe(false)
    expect((await chapterRepository.findChapterPage(story._id, true, { limit: 10, sort: 'asc' })).items).toHaveLength(5)
    await expect(chapterRepository.findChapterPage(story._id, true, { limit: 2, sort: 'desc', cursor: first.meta.nextCursor! })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('only one worker claims a due approved chapter', async () => {
    const story = await createStory('schedule')
    const chapter = await Chapter.create({ storyId: story._id, title: 'Scheduled', slug: 'scheduled', order: 1, contentHtml: '<p>Content</p>', status: 'scheduled', moderationStatus: 'approved', publishAt: new Date(0) })
    const claims = await Promise.all(Array.from({ length: 10 }, () => chapterRepository.claimScheduled(chapter._id, new Date())))
    expect(claims.filter(Boolean)).toHaveLength(1)
    const pending = await Chapter.create({ storyId: story._id, title: 'Pending', slug: 'pending', order: 2, contentHtml: '<p>Content</p>', status: 'scheduled', moderationStatus: 'pending', publishAt: new Date(0) })
    expect(await chapterRepository.claimScheduled(pending._id, new Date())).toBeNull()
  })

  it('scheduled scan excludes hidden parents before applying its batch limit', async () => {
    const hidden = await createStory('scheduled-hidden', { moderationStatus: 'hidden' })
    const visible = await createStory('scheduled-visible')
    await Chapter.insertMany(Array.from({ length: 101 }, (_, i) => ({ storyId: hidden._id, title: 'Hidden', slug: 'hidden-' + i, order: i + 1, contentHtml: '<p>Hidden</p>', status: 'scheduled', moderationStatus: 'approved', publishAt: new Date(0) })))
    const eligible = await Chapter.create({ storyId: visible._id, title: 'Eligible', slug: 'eligible', order: 1, contentHtml: '<p>Eligible</p>', status: 'scheduled', moderationStatus: 'approved', publishAt: new Date(0) })
    const due = await chapterRepository.findScheduledDue()
    expect(due.some(chapter => chapter._id.equals(eligible._id))).toBe(true)
    expect(due.some(chapter => chapter.storyId.equals(hidden._id))).toBe(false)
  })

  it('resume selects exact chapter ID despite more than one page of title matches', async () => {
    const story = await createStory('resume-exact')
    const chapters = await Chapter.insertMany(Array.from({ length: 65 }, (_, i) => ({ storyId: story._id, title: 'Chapter 65 reference', slug: 'resume-' + i, order: i + 1, contentHtml: '<p>Public</p>', status: 'published', moderationStatus: 'approved' })))
    const target = chapters[64]
    const page = await chapterRepository.findChapterPage(story._id, false, { chapterId: String(target._id), sort: 'asc', limit: 50 })
    expect(page.items.map(item => String(item._id))).toEqual([String(target._id)])
    await Chapter.updateOne({ _id: target._id }, { moderationStatus: 'pending' })
    const hidden = await chapterRepository.findChapterPage(story._id, false, { chapterId: String(target._id), sort: 'asc', limit: 50 })
    expect(hidden.items).toEqual([])
    const foreign = await chapterRepository.findChapterPage(new Types.ObjectId(), true, { chapterId: String(target._id), sort: 'asc', limit: 50 })
    expect(foreign.items).toEqual([])
  })

  it('concurrent ratings maintain exact count and mean', async () => {
    const story = await createStory('ratings')
    const scores = [1, 2, 3, 4, 5, 5, 4, 3]
    await Promise.all(scores.map(score => ratingRepository.upsert(story._id, new Types.ObjectId(), score)))
    const current = await Story.findById(story._id)
    expect(current?.ratingCount).toBe(scores.length)
    expect(current?.ratingAverage).toBe(3.4)
  }, 20000)

  it('editing approved content requires review again and hides it from public reads', async () => {
    const { chaptersService } = await import('../modules/chapters/chapters.service.js')
    const { updateStory, getStoryBySlug } = await import('../modules/stories/stories.service.js')
    const story = await createStory('re-review')
    const chapter = await Chapter.create({ storyId: story._id, title: 'Approved', slug: 'approved', order: 1, contentHtml: '<p>Old</p>', status: 'published', moderationStatus: 'approved' })
    await chaptersService.updateChapter(chapter.id, { contentHtml: '<p>Edited</p>' })
    expect((await Chapter.findById(chapter._id))?.moderationStatus).toBe('pending')
    await expect(chaptersService.getChapterBySlug(story.slug, chapter.slug)).rejects.toMatchObject({ statusCode: 404 })
    await updateStory(story.id, { description: 'Edited description' })
    expect((await Story.findById(story._id))?.moderationStatus).toBe('pending')
    await expect(getStoryBySlug(story.slug)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('library populations do not expose hidden story or chapter metadata', async () => {
    const { followRepository } = await import('../repositories/follow.repository.js')
    const { bookmarkRepository } = await import('../repositories/bookmark.repository.js')
    const { readingHistoryRepository } = await import('../repositories/reading-history.repository.js')
    const { readingHistoryService } = await import('../modules/reading-history/reading-history.service.js')
    const { bookmarksService } = await import('../modules/bookmarks/bookmarks.service.js')
    const story = await createStory('library-hidden')
    const chapter = await Chapter.create({ storyId: story._id, title: 'Private', slug: 'private', order: 1, contentHtml: '<p>Private</p>', status: 'published', moderationStatus: 'approved' })
    await followRepository.create(author, story._id)
    await bookmarkRepository.create(author, chapter._id)
    await readingHistoryRepository.upsert(author, story._id, chapter._id)
    await Story.updateOne({ _id: story._id }, { moderationStatus: 'hidden' })
    const follows = await followRepository.findByUserId(author)
    expect(follows.find(item => item.storyId === null)).toBeDefined()
    expect(await bookmarksService.getUserBookmarks(author.toString())).toEqual([])
    expect(await readingHistoryService.getStoryReadingProgress(author.toString(), story.id)).toBeNull()
  })

  it('concurrent chapter recounts discard stale caller counts', async () => {
    const story = await createStory('count-race')
    await Promise.all(Array.from({ length: 8 }, async (_, i) => {
      await Chapter.create({ storyId: story._id, title: 'Chapter', slug: 'count-' + i, order: i + 1, contentHtml: '<p>Public</p>', status: 'published', moderationStatus: 'approved' })
      await storyRepository.updateById(story.id, { chapterCount: i })
    }))
    expect((await Story.findById(story._id))?.chapterCount).toBe(8)
  }, 20000)

  it('concurrent follows and repeated removals keep the stored counter exact', async () => {
    const story = await createStory('follow-race')
    const users = Array.from({ length: 8 }, () => new Types.ObjectId().toString())
    await Promise.all(users.map(user => followRepository.change(user, story.id, 'toggle')))
    expect((await Story.findById(story._id))?.followCount).toBe(8)
    await Promise.all(Array.from({ length: 5 }, () => followRepository.change(users[0], story.id, 'remove')))
    expect((await Story.findById(story._id))?.followCount).toBe(7)
    expect(await Follow.countDocuments({ storyId: story._id })).toBe(7)
    await Story.updateOne({ _id: story._id }, { moderationStatus: 'hidden' })
    await expect(followRepository.change(new Types.ObjectId().toString(), story.id, 'toggle')).rejects.toMatchObject({ statusCode: 404 })
    await followRepository.change(users[1], story.id, 'remove')
    expect((await Story.findById(story._id))?.followCount).toBe(6)
  }, 20000)

  it('atomic comment likes do not lose other users or drift from array size', async () => {
    const story = await createStory('like-race')
    const comment = await Comment.create({ storyId: story._id, userId: author, content: 'Test comment' })
    const users = Array.from({ length: 20 }, () => new Types.ObjectId())
    await Promise.all(users.map(user => commentRepository.toggleLike(comment._id, user)))
    expect((await Comment.findById(comment._id))?.likeCount).toBe(20)
    await Promise.all(Array.from({ length: 10 }, () => commentRepository.toggleLike(comment._id, users[0])))
    const current = await Comment.findById(comment._id)
    expect(current?.likeCount).toBe(20)
    expect(current?.likedUserIds).toHaveLength(20)
    await Comment.updateOne({ _id: comment._id }, { isDeleted: true })
    expect(await commentRepository.toggleLike(comment._id, users[0])).toBeNull()
  })

  it('report assignment and notes have atomic audits and cannot reopen a resolved report', async () => {
    const story = await createStory('report-audit')
    const report = await Report.create({ reporterId: author, targetType: 'story', targetId: story._id, reason: 'other' })
    await expect(reportRepository.assignReport(report._id, author, 'invalid')).rejects.toThrow()
    expect((await Report.findById(report._id))?.status).toBe('pending')
    await reportRepository.assignReport(report._id, author)
    await reportRepository.addNote(report._id, author, 'Checked source')
    expect(await ModerationLog.countDocuments({ targetId: report._id })).toBe(2)
    await reportRepository.resolveReport(report._id, { action: 'dismiss', moderatorId: author })
    await expect(reportRepository.assignReport(report._id, author)).rejects.toMatchObject({ code: 'REPORT_NOT_OPEN' })
    expect((await Report.findById(report._id))?.status).toBe('dismissed')
    expect(await ModerationLog.countDocuments({ targetId: report._id })).toBe(3)
  })

  it('audit failure rolls back the moderation decision', async () => {
    const story = await createStory('atomic-audit')
    story.moderationStatus = 'hidden'
    await expect(moderationLogRepository.saveWithLog(story, { moderatorId: 'invalid-id', action: 'hide_story', targetType: 'story', targetId: story._id })).rejects.toThrow()
    expect((await Story.findById(story._id))?.moderationStatus).toBe('approved')
    await moderationLogRepository.saveWithLog(story, { moderatorId: author, action: 'hide_story', targetType: 'story', targetId: story._id })
    expect((await Story.findById(story._id))?.moderationStatus).toBe('hidden')
    expect(await ModerationLog.countDocuments({ targetId: story._id })).toBe(1)
  })

  it('atomic rate counters retain a TTL under concurrency and repair immortal keys', async () => {
    const { RATE_LIMIT_SCRIPT } = await import('../middlewares/rateLimit.js')
    const key = `${database}:rate`
    try {
      await cache.set(key, '1')
      const results = await Promise.all(Array.from({ length: 20 }, () => cache.eval(RATE_LIMIT_SCRIPT, 1, key, 60))) as number[][]
      expect(new Set(results.map(result => result[0])).size).toBe(20)
      expect(await cache.ttl(key)).toBeGreaterThan(0)
    } finally { await cache.del(key) }
  })

  it('real Socket client receives the documented payload and enforces token purpose, expiry and lock', async () => {
    // Reuse the client workspace dependency; no extra package or application credentials.
    const { io } = createRequire(path.resolve('../client/package.json'))('socket.io-client') as { io: (url: string, options: object) => TestSocket }
    const { initSocket, closeSocket, emitToUser } = await import('../config/socket.js')
    const { signAccessToken, signRefreshToken } = await import('../common/jwt.js')
    const { notificationsService } = await import('../modules/notifications/notifications.service.js')
    const account = await User.create({ email: `${database}-socket@example.test`, username: 's' + database.slice(-18), displayName: 'Socket test', provider: 'local' })
    const server = http.createServer(app)
    initSocket(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    const clients: TestSocket[] = []
    const client = (token: string) => {
      const socket = io(url, { autoConnect: false, reconnection: false, transports: ['websocket'], auth: { token } })
      clients.push(socket)
      return socket
    }
    try {
      const wrong = client(signRefreshToken({ id: account.id }))
      const rejected = waitSocketEvent(wrong, 'connect_error')
      wrong.connect()
      expect(await rejected).toBeInstanceOf(Error)

      const expiring = client(signAccessToken({ id: account.id }, { expiresIn: '2s' }))
      const connected = waitSocketEvent(expiring, 'connect')
      expiring.connect()
      await connected
      const payload = waitSocketEvent(expiring, 'notification:new')
      await notificationsService.createAndEmitNotification(account.id, { type: 'system', title: 'Contract test', message: 'Direct payload', link: '/notifications' })
      expect(await payload).toMatchObject({ title: 'Contract test', message: 'Direct payload', link: '/notifications' })
      expect(await waitSocketEvent(expiring, 'disconnect')).toBe('io server disconnect')

      const locked = client(signAccessToken({ id: account.id }))
      const ready = waitSocketEvent(locked, 'connect')
      locked.connect()
      await ready
      const disconnected = waitSocketEvent(locked, 'disconnect', 18000)
      await User.updateOne({ _id: account._id }, { isLocked: true })
      expect(await emitToUser(account.id, 'notification:new', { title: 'Must not emit' })).toBe(false)
      expect(await disconnected).toBe('io server disconnect')
    } finally {
      for (const socket of clients) socket.disconnect()
      await closeSocket()
    }
  }, 30000)

  it('cache hits retain their original expiry and discover new candidates after expiry', async () => {
    const { redis } = await import('../config/redis.js')
    const { getSuggestions } = await import('../modules/search/search.service.js')
    if (redis.status !== 'ready') await redis.connect()
    const q = database + '-cache-expiry'
    const key = 'cache:search:sug:' + encodeURIComponent(q)
    try {
      await createStory('cache-first', { title: q, viewCount: 10 })
      expect((await getSuggestions(q)).stories).toHaveLength(1)
      await redis.pexpire(key, 200)
      await createStory('cache-second', { title: q, viewCount: 20 })
      expect((await getSuggestions(q)).stories).toHaveLength(1)
      expect(await redis.pttl(key)).toBeLessThanOrEqual(200)
      await new Promise(resolve => setTimeout(resolve, 250))
      expect((await getSuggestions(q)).stories).toHaveLength(2)
    } finally { await cache.del(key) }
  })

  it('measures synthetic autosuggest latency with cold, warm and unavailable Redis', async () => {
    const { redis } = await import('../config/redis.js')
    const { getSuggestions } = await import('../modules/search/search.service.js')
    const query = database + '-benchmark'
    await Story.insertMany(Array.from({ length: 1000 }, (_, i) => ({ title: query + ' Dragon ' + i, slug: query + '-' + i, description: 'Synthetic search dataset', authorId: author, moderationStatus: 'approved' })))
    const key = 'cache:search:sug:' + encodeURIComponent(query)
    const measurements: object[] = []
    const server = http.createServer(app)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1/search/suggestions?q=${encodeURIComponent(query)}`
    const measureHttp = async (mode: 'cold' | 'warm') => {
      const times: number[] = []
      for (let batch = 0; batch < 4; batch++) {
        if (mode === 'cold') await redis.del(key)
        await Promise.all(Array.from({ length: 5 }, async () => {
          const start = performance.now()
          const response = await fetch(url)
          expect(response.status).toBe(200)
          await response.json()
          times.push(performance.now() - start)
        }))
      }
      times.sort((a, b) => a - b)
      measurements.push({ mode: `http-${mode}`, records: 1000, samples: 20, concurrency: 5, p50Ms: Math.round(times[9]), p95Ms: Math.round(times[18]), maxMs: Math.round(times[19]) })
    }
    const measure = async (mode: string) => {
      const times: number[] = []
      for (let batch = 0; batch < 10; batch++) {
        if (mode === 'cold') await redis.del(key)
        await Promise.all(Array.from({ length: 10 }, async () => {
          const start = performance.now()
          const result = await getSuggestions(query)
          expect(result.stories).toHaveLength(5)
          times.push(performance.now() - start)
        }))
      }
      times.sort((a, b) => a - b)
      measurements.push({ mode, records: 1000, samples: times.length, concurrency: 10, p50Ms: Math.round(times[49]), p95Ms: Math.round(times[94]), maxMs: Math.round(times[99]) })
    }
    try {
      if (redis.status !== 'ready') await redis.connect()
      await measure('cold')
      await getSuggestions(query)
      await measure('warm')
      // 40 requests remain below the real 60/minute/IP quota; do not disable middleware.
      await measureHttp('cold')
      await measureHttp('warm')
      await redis.del(key)
      redis.disconnect()
      await measure('redis-unavailable')
      expect((await fetch(url)).status).toBe(503)
      await writeFile('phase-a-benchmark.json', JSON.stringify({ scope: 'Synthetic loopback MongoDB 8 / Redis 7; service and HTTP measurements; cold means cache cleared per batch, HTTP limiter enabled, Redis outage HTTP=503; not a production SLA', measurements }, null, 2))
    } finally {
      redis.disconnect()
      await cache.del(key)
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  }, 30000)

  it('real public HTTP routes enforce visibility and return mature warning', async () => {
    const server = http.createServer(app)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    const origin = `http://127.0.0.1:${address.port}/api/v1`
    try {
      const story = await createStory('http', { contentWarning: 'mature18+' })
      await Chapter.create({ storyId: story._id, title: 'Public', slug: 'public', order: 1, contentHtml: '<p onclick="bad()">hello</p>', status: 'published', moderationStatus: 'approved' })
      let response = await fetch(`${origin}/stories/${story.slug}/chapters/public`)
      expect(response.status).toBe(200)
      const body = await response.json() as { data: { story: { contentWarning: string }; chapter: { contentHtml: string } } }
      expect(body.data.story.contentWarning).toBe('mature18+')
      expect(body.data.chapter.contentHtml).toBe('<p>hello</p>')
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      await Story.updateOne({ _id: story._id }, { moderationStatus: 'hidden' })
      for (const path of [`/stories/${story.slug}`, `/stories/${story.slug}/chapters`, `/stories/${story.slug}/chapters/public`]) {
        response = await fetch(origin + path)
        expect(response.status).toBe(404)
      }
    } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
  })
  it('Phase 8: bounded sitemap and read workload on 1000 stories / 50000 chapters', async () => {
    const { seoService } = await import('../modules/seo/seo.service.js')
    const { seoRepository } = await import('../repositories/seo.repository.js')
    const stories = Array.from({ length: 1000 }, (_, index) => ({ _id: new Types.ObjectId(), title: 'SEO workload ' + index,
      slug: 'seo-workload-' + database.replaceAll('_', '-') + '-' + index, description: 'Fixture benchmark', authorId: author,
      status: 'ongoing', moderationStatus: index % 10 === 0 ? 'hidden' : 'approved', contentWarning: 'none', genreIds: [], tagIds: [], createdAt: new Date(), updatedAt: new Date() }))
    const ids = stories.map(story => story._id)
    try {
      await Story.collection.insertMany(stories)
      for (let batch = 0; batch < 50; batch++) {
        await Chapter.collection.insertMany(stories.map(story => ({ storyId: story._id, title: 'Chương ' + (batch + 1), slug: 'chuong-' + (batch + 1),
          order: batch + 1, contentHtml: '<p>Nội dung kiểm thử.</p>', status: 'published', moderationStatus: batch === 0 ? 'pending' : 'approved',
          createdAt: new Date(), updatedAt: new Date() })))
      }
      const start = performance.now()
      const manifest = await seoService.buildSitemapManifestData('chapters')
      const manifestMs = performance.now() - start
      expect(manifest.shards.every(shard => shard.length <= 1000)).toBe(true)
      expect(manifest.shards.flat().length).toBeGreaterThanOrEqual(50000)
      // Canonical URLs resolve by order: chapter 1 is pending, chapter 2 is public.
      await expect(seoService.getChapterPage(stories[1].slug, 'chuong-1')).rejects.toMatchObject({ statusCode: 404, code: 'CHAPTER_NOT_FOUND' })
      const stats = (samples: number[]) => {
        const sorted = [...samples].sort((a, b) => a - b)
        const percentile = (p: number) => Math.round(sorted[Math.ceil(sorted.length * p) - 1])
        return { samples: sorted.length, p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), errorRate: 0 }
      }
      const levels: Array<{ concurrency: number; samples: number; p50Ms: number; p95Ms: number; p99Ms: number; errorRate: number; queryCount: number }> = []
      const priorDebug = mongoose.get('debug')
      try {
        for (const concurrency of [1, 10, 25]) {
          const samples: number[] = []
          let queryCount = 0
          mongoose.set('debug', () => { queryCount++ })
          for (let batch = 0; batch < 3; batch++) await Promise.all(Array.from({ length: concurrency }, async (_, i) => {
            const start = performance.now()
            const detail = await seoService.getChapterPage(stories[i * 10 + 1].slug, 'chuong-2')
            expect(detail.chapter.order).toBe(2)
            expect(detail.chapter.contentHtml).toBe('<p>Nội dung kiểm thử.</p>')
            samples.push(performance.now() - start)
          }))
          levels.push({ concurrency, ...stats(samples), queryCount })
        }
      } finally { mongoose.set('debug', priorDebug ?? false) }
      const longHtml = '<p>' + 'Nội dung chương dài. '.repeat(5000) + '</p>'
      await Chapter.updateOne({ storyId: stories[1]._id, slug: 'chuong-2' }, { $set: { contentHtml: longHtml } })
      const longStart = performance.now()
      expect((await seoService.getChapterPage(stories[1].slug, 'chuong-2')).chapter.contentHtml).toBe(longHtml)
      const longChapterMs = Math.round(performance.now() - longStart)
      const visible = await seoRepository.hydrateStoryIdsForSitemap(ids.map(String))
      expect(visible).toHaveLength(900)
      const { redis } = await import('../config/redis.js')
      const { sitemapJob } = await import('../jobs/sitemap-manifest.job.js')
      if (redis.status !== 'ready') await redis.connect()
      await sitemapJob.runNow()
      const summary = (await sitemapJob.getSummary())!
      expect(summary.format).toBe('shards')
      const legacy = (await cache.get('seo:sitemap:manifest:' + summary.generation))!
      const single = (await cache.hget('seo:sitemap:shards:' + summary.generation, 'chapters:0'))!
      const header = (await cache.hget('seo:sitemap:shards:' + summary.generation, 'meta'))!
      expect(Buffer.byteLength(single)).toBeLessThanOrEqual(28 * 1024)
      expect(Buffer.byteLength(legacy)).toBeGreaterThan(Buffer.byteLength(single) * 40)
      const shardSamples: number[] = []
      await Promise.all(Array.from({ length: 25 }, async () => {
        const start = performance.now()
        expect(await sitemapJob.getShard(summary.generation, 'chapters', 0)).toEqual(JSON.parse(single))
        shardSamples.push(performance.now() - start)
      }))
      const shardServing = { concurrency: 25, ...stats(shardSamples), legacyInventoryBytes: Buffer.byteLength(legacy), shardBytes: Buffer.byteLength(single), metadataBytes: Buffer.byteLength(header), includesMongoHydrationOrHttp: false }
      const report = { fixtureStories: 1000, fixtureChapters: 50000, levels,
        longChapterBytes: Buffer.byteLength(longHtml), longChapterMs,
        manifestMs: Math.round(manifestMs), manifestBytes: Buffer.byteLength(JSON.stringify(manifest)),
        rssBytes: process.memoryUsage().rss, shardServing, httpOrProductionSla: false }
      await writeFile(path.join(process.cwd(), 'phase-8-benchmark.json'), JSON.stringify(report, null, 2))
    } finally { await Chapter.deleteMany({ storyId: { $in: ids } }); await Story.deleteMany({ _id: { $in: ids } }) }
  }, 90000)

  it('Phase 8: valid long title, public taxonomy/TOC contract and independent quotas', async () => {
    const { chaptersService } = await import('../modules/chapters/chapters.service.js')
    const { createChapterSchema } = await import('../modules/chapters/chapters.validation.js')
    const { redis } = await import('../config/redis.js')
    if (redis.status !== 'ready') await redis.connect()
    const genre = await Genre.create({ name: database, slug: database.replaceAll('_', '-') })
    const tag = await Tag.create({ name: database, slug: database.replaceAll('_', '-') })
    const story = await createStory('dto', { slug: 'dto-' + randomUUID(), genreIds: [genre._id], tagIds: [tag._id] })
    const chapter = await chaptersService.createChapter(String(story._id), createChapterSchema.parse({ title: 'a'.repeat(200), contentHtml: '<p>Valid title at boundary.</p>', status: 'published' }))
    await Chapter.updateOne({ _id: chapter._id }, { moderationStatus: 'approved' })
    expect(chapter.slug.length).toBe(209)
    const server = http.createServer(app)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port
    const url = origin + '/api/v1/seo/stories/' + story.slug
    const quotaKeys = ['127.0.0.1', '::ffff:127.0.0.1'].map(ip => 'ratelimit:seo-cover:ip:' + ip)
    try {
      const response = await fetch(url + '/chapters/' + chapter.slug)
      expect(response.status).toBe(200)
      const page = await response.json() as { data: { story: { genres: Array<{ _id: string }>; tags: Array<{ _id: string }> } } }
      expect(page.data.story.genres[0]._id).toBe(String(genre._id))
      expect(page.data.story.tags[0]._id).toBe(String(tag._id))
      const body = await (await fetch(url)).json() as { data: { toc: { items: Array<{ storyId: string; viewCount: number; createdAt: string }> } } }
      expect(body.data.toc.items[0]).toMatchObject({ storyId: String(story._id), viewCount: 0, createdAt: chapter.createdAt.toISOString() })
      for (const key of quotaKeys) await cache.set(key, '120', 'EX', 60)
      expect((await fetch(origin + '/api/v1/seo/covers/' + story._id)).status).toBe(429)
      expect((await fetch(url)).status).toBe(200)
      expect((await Chapter.findById(chapter._id))!.viewCount).toBe(0)
    } finally {
      await cache.del(...quotaKeys)
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
  it('Phase 8: real SEO projections, mature gate, sitemap generations and hide revalidation', async () => {
    const { redis } = await import('../config/redis.js')
    const { sitemapJob } = await import('../jobs/sitemap-manifest.job.js')
    if (redis.status !== 'ready') await redis.connect()
    const story = await createStory('seo', { slug: 'seo-' + randomUUID(), coverUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' })
    const chapter = await Chapter.create({ storyId: story._id, slug: 'seo-chapter', title: 'SEO chapter', order: 1, contentHtml: '<p>Safe</p><script>bad()</script>', status: 'published', moderationStatus: 'approved' })
    const server = http.createServer(app)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port
    const path = '/api/v1/seo/stories/' + story.slug
    try {
      const detail = await fetch(origin + path + '/chapters/seo-chapter')
      expect(detail.status).toBe(200)
      const body = await detail.json() as { data: { chapter: { contentHtml: string }; story: Record<string, unknown> } }
      expect(body.data.chapter.contentHtml).toBe('<p>Safe</p>')
      expect(JSON.stringify(body.data.story)).not.toContain('email')
      expect(body.data.story.coverUrl).toBe('/seo/covers/' + story._id)
      expect(JSON.stringify(body.data.story)).not.toContain('base64')
      expect((await fetch(origin + '/api/v1/seo/covers/' + story._id)).headers.get('content-type')).toBe('image/png')
      const catalog = await (await fetch(origin + '/api/v1/seo/catalog/stories')).json() as { data: { stories: Array<{ _id: string; coverUrl?: string }> } }
      expect(catalog.data.stories.find(item => item._id === String(story._id))?.coverUrl).toBe('/seo/covers/' + story._id)
      expect((await Chapter.findById(chapter._id))!.viewCount).toBe(0)
      expect((await Story.findById(story._id))!.viewCount).toBe(0)
      await sitemapJob.runNow()
      const first = (await sitemapJob.getManifest())!
      await sitemapJob.runNow()
      expect((await sitemapJob.getManifest())?.generation).not.toBe(first.generation)
      expect(await sitemapJob.getManifest(first.generation)).toEqual(first)
      const shardIndex = first.storyShards.findIndex(ids => ids.includes(String(story._id)))
      expect(shardIndex).toBeGreaterThanOrEqual(0)
      const shardUrl = origin + '/sitemaps/' + first.generation + '/stories/' + shardIndex + '.xml'
      expect(await (await fetch(shardUrl)).text()).toContain(story.slug)
      await Story.updateOne({ _id: story._id }, { $set: { contentWarning: 'mature18+' } })
      const mature = await (await fetch(origin + path + '/chapters/seo-chapter')).json() as { data: { chapter: { contentHtml: string }; meta: { indexable: boolean } } }
      expect(mature.data.chapter.contentHtml).toBe('')
      expect(mature.data.meta.indexable).toBe(false)
      expect(await (await fetch(shardUrl)).text()).not.toContain(story.slug)
      await Story.updateOne({ _id: story._id }, { $set: { moderationStatus: 'hidden' } })
      expect((await fetch(origin + path)).status).toBe(404)
      expect((await fetch(origin + path + '/chapters/seo-chapter')).status).toBe(404)
      expect((await fetch(origin + path, { method: 'HEAD' })).headers.get('cache-control')).toBe('no-store')
      // Real Lua budget rejection must preserve the last published generation.
      const pointer = (await sitemapJob.getManifest())!.generation
      const budgetMember = 'ffffffffffffffff:' + 32 * 1024 * 1024
      await cache.zadd('seo:sitemap:generations', Math.floor(Date.now() / 1000) + 60, budgetMember)
      try {
        await sitemapJob.runNow()
        expect((await sitemapJob.getManifest())?.generation).toBe(pointer)
      } finally { await cache.zrem('seo:sitemap:generations', budgetMember) }
      const retainedBytes = await cache.memory('USAGE', 'seo:sitemap:manifest:' + pointer)
      expect(Number(retainedBytes)).toBeGreaterThan(0)
      expect(Number(await cache.memory('USAGE', 'seo:sitemap:shards:' + pointer))).toBeGreaterThan(0)
      expect(await cache.ttl('seo:sitemap:shards:' + pointer)).toBeGreaterThan(0)
      const summary = (await sitemapJob.getSummary(pointer))!
      expect(summary.format).toBe('shards')
      expect(await sitemapJob.getShard(pointer, 'stories', shardIndex)).toEqual(first.storyShards[shardIndex])
      // A dependency outage is not a successful empty SEO page.
      redis.disconnect()
      const outage = await fetch(origin + path)
      expect(outage.status).toBe(503)
      expect(outage.headers.get('x-robots-tag')).toBe('noindex')
    } finally {
      await sitemapJob.stop()
      await new Promise<void>(resolve => server.close(() => resolve()))
      redis.disconnect()
    }
  }, 20000)

})
