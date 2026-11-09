import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
const mocks = vi.hoisted(() => ({ user: undefined as undefined | { id: string; role: string; authorStatus?: string }, service: vi.fn() }))
vi.mock('../../../middlewares/authenticate.js', async () => {
  const { AppError } = await import('../../../common/AppError.js')
  return { authenticate: (req: Request, _res: Response, next: NextFunction) => {
    if (!mocks.user) return next(AppError.unauthorized())
    req.user = mocks.user as Request['user']; next()
  } }
})
vi.mock('../../../middlewares/rateLimit.js', () => ({ rateLimit: () => (_req: Request, _res: Response, next: NextFunction) => next() }))
vi.mock('../../../repositories/story.repository.js', () => ({ storyRepository: { findById: vi.fn(async () => ({ authorId: 'owner' })) } }))
vi.mock('../../../repositories/chapter.repository.js', () => ({ chapterRepository: {} }))
vi.mock('../chapters.controller.js', () => ({ chaptersController: {
  getChaptersByStory: vi.fn(), getChapterBySlug: vi.fn(), createChapter: vi.fn(), updateChapter: vi.fn(), deleteChapter: vi.fn(), getChapterPreview: vi.fn(),
} }))
vi.mock('../crawler.service.js', () => ({ crawlerService: { metadata: mocks.service, catalog: mocks.service, preview: mocks.service, importChapter: mocks.service } }))
import router from '../chapters.routes.js'
const storyId = '123456789012345678901234'
function call(action: string, body: unknown) {
  return new Promise<{ status: number; error?: unknown; data?: unknown }>((resolve, reject) => {
    let status = 200
    const req = { method: 'POST', url: action === 'metadata' ? '/stories/crawl/metadata' : `/stories/${storyId}/crawl/${action}`, headers: {}, body } as Request
    const res = { status: (value: number) => { status = value; return res }, json: (data: unknown) => resolve({ status, data }) } as unknown as Response
    router(req, res, error => error ? resolve({ status: error.statusCode, error }) : reject(new Error('Route not matched')))
  })
}
const payloads = {
  catalog: { url: 'https://books.example.org/story' },
  preview: { url: 'https://books.example.org/1' },
  import: { previewToken: '12345678-1234-4234-8234-123456789012', title: 'Chương', order: 1, rightsConfirmed: true },
}
beforeEach(() => { mocks.user = undefined; mocks.service.mockReset().mockResolvedValue({ nextCursor: null, hasNextPage: false, alreadyImported: false }) })

describe('metadata before story creation', () => {
  it.each([
    [undefined, 401], [{ id: 'new', role: 'user' }, 403],
    [{ id: 'new', role: 'moderator' }, 403], [{ id: 'new', role: 'author', authorStatus: 'pending' }, 403],
    [{ id: 'new', role: 'author', authorStatus: 'approved' }, 200], [{ id: 'admin', role: 'admin' }, 200],
  ] as const)('checks authorization without requiring an existing story: %j', async (user, status) => {
    mocks.user = user
    expect((await call('metadata', payloads.catalog)).status).toBe(status)
    expect(mocks.service).toHaveBeenCalledTimes(status === 200 ? 1 : 0)
    if (status === 200) expect(mocks.service).toHaveBeenCalledWith(user!.id, payloads.catalog.url)
  })
  it('rejects client selectors and invalid URLs', async () => {
    mocks.user = { id: 'new', role: 'author', authorStatus: 'approved' }
    for (const body of [{ url: 'invalid' }, { ...payloads.catalog, selector: 'body' }]) {
      expect((await call('metadata', body)).status).toBe(400)
    }
    expect(mocks.service).not.toHaveBeenCalled()
  })
})
describe.each(Object.entries(payloads))('crawler %s route authorization', (action, body) => {
  it.each([
    [undefined, 401],
    [{ id: 'owner', role: 'user' }, 403],
    [{ id: 'owner', role: 'moderator' }, 403],
    [{ id: 'owner', role: 'author', authorStatus: 'pending' }, 403],
    [{ id: 'other', role: 'author', authorStatus: 'approved' }, 403],
  ] as const)('rejects unauthorized identity %j', async (user, expected) => {
    mocks.user = user
    expect((await call(action, body)).status).toBe(expected)
    expect(mocks.service).not.toHaveBeenCalled()
  })
  it.each(['author', 'admin'])('accepts approved owner or admin (%s)', async role => {
    mocks.user = { id: role === 'author' ? 'owner' : 'admin', role, authorStatus: 'approved' }
    expect((await call(action, body)).status).toBe(action === 'import' ? 201 : 200)
    expect(mocks.service).toHaveBeenCalledTimes(1)
  })
  it('validates payload before calling the service', async () => {
    mocks.user = { id: 'owner', role: 'author', authorStatus: 'approved' }
    expect((await call(action, {})).status).toBe(400)
    expect(mocks.service).not.toHaveBeenCalled()
  })
})
