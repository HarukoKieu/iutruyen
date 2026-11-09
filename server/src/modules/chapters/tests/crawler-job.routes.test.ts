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
vi.mock('../crawler-job.service.js', () => ({ crawlerJobService: { create: mocks.service, targets: mocks.service, list: mocks.service, detail: mocks.service, tasks: mocks.service, control: mocks.service } }))
import router from '../crawler-job.routes.js'
const jobId = '123456789012345678901234'
const create = { requestKey: '12345678-1234-4234-8234-123456789012', sources: [{ url: 'https://books.example.org/story', storyId: jobId }] }
function call(method: string, suffix: string, body: unknown = {}, query = {}) {
  return new Promise<{ status: number; error?: unknown; data?: unknown }>((resolve, reject) => {
    let status = 200
    const req = { method, url: `/stories/crawl/jobs${suffix}`, headers: {}, body, query } as Request
    const res = { status: (value: number) => { status = value; return res }, json: (data: unknown) => resolve({ status, data }) } as unknown as Response
    router(req, res, error => error ? resolve({ status: error.statusCode, error }) : reject(new Error('Route not matched')))
  })
}
beforeEach(() => { mocks.user = undefined; mocks.service.mockReset().mockResolvedValue({ items: [], meta: { hasMore: false } }) })
describe.each([
  ['POST', '', create], ['GET', '', {}], ['GET', `/${jobId}`, {}], ['GET', `/${jobId}/tasks`, {}], ['POST', `/${jobId}/control`, { action: 'start', rightsConfirmed: true }],
])('bulk route %s %s', (method, suffix, body) => {
  it.each([
    [undefined, 401], [{ id: 'actor', role: 'user' }, 403], [{ id: 'actor', role: 'moderator' }, 403],
    [{ id: 'actor', role: 'author', authorStatus: 'revoked' }, 403],
    [{ id: 'actor', role: 'author', authorStatus: 'approved' }, 200], [{ id: 'admin', role: 'admin' }, 200],
  ] as const)('requires approved author/admin %j', async (user, expected) => {
    mocks.user = user
    expect((await call(method as string, suffix as string, body)).status).toBe(expected === 200 && method === 'POST' && suffix === '' ? 202 : expected)
    expect(mocks.service).toHaveBeenCalledTimes(expected === 200 ? 1 : 0)
  })
})
describe('bulk route input boundaries', () => {
  it('rejects missing rights confirmation and raw selectors before service', async () => {
    mocks.user = { id: 'actor', role: 'author', authorStatus: 'approved' }
    expect((await call('POST', `/${jobId}/control`, { action: 'start' })).status).toBe(400)
    expect((await call('POST', '', { ...create, selectors: 'body' })).status).toBe(400)
    expect(mocks.service).not.toHaveBeenCalled()
  })
  it('validates jobId and cursor page limits', async () => {
    mocks.user = { id: 'actor', role: 'author', authorStatus: 'approved' }
    expect((await call('GET', '/invalid')).status).toBe(400)
    expect((await call('GET', `/${jobId}/tasks`, {}, { limit: '101' })).status).toBe(400)
    expect(mocks.service).not.toHaveBeenCalled()
  })
})
