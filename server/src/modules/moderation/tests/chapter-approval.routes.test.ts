import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

const mocks = vi.hoisted(() => ({
  user: undefined as Request['user'],
  approve: vi.fn(),
}))
vi.mock('../../../middlewares/authenticate.js', async () => {
  const { AppError } = await import('../../../common/AppError.js')
  return { authenticate: (req: Request, _res: Response, next: NextFunction) => {
    if (!mocks.user) return next(AppError.unauthorized())
    req.user = mocks.user
    next()
  } }
})
vi.mock('../../../middlewares/rateLimit.js', () => ({ rateLimit: () => (_req: Request, _res: Response, next: NextFunction) => next() }))
vi.mock('../moderation.service.js', () => ({ moderationService: { moderateChapter: mocks.approve } }))
import router from '../moderation.routes.js'

const chapterId = '123456789012345678901234'
function approveChapter() {
  return new Promise<number>((resolve, reject) => {
    let status = 200
    const req = { method: 'PATCH', url: `/chapters/${chapterId}/approve`, headers: {}, body: { notifyUser: false } } as Request
    const res = { status: (value: number) => { status = value; return res }, json: () => { resolve(status); return res } } as unknown as Response
    router(req, res, error => error ? resolve(error.statusCode) : reject(new Error('Route not matched')))
  })
}

beforeEach(() => {
  mocks.user = undefined
  mocks.approve.mockReset().mockResolvedValue({ moderationStatus: 'approved' })
})

describe('chapter approval permissions', () => {
  it('requires authentication', async () => {
    expect(await approveChapter()).toBe(401)
    expect(mocks.approve).not.toHaveBeenCalled()
  })
  it.each(['user', 'author'] as const)('does not let %s approve a chapter', async role => {
    mocks.user = { id: 'owner', role } as Request['user']
    expect(await approveChapter()).toBe(403)
    expect(mocks.approve).not.toHaveBeenCalled()
  })
  it.each(['moderator', 'admin'] as const)('allows %s to approve a chapter', async role => {
    mocks.user = { id: 'reviewer', role } as Request['user']
    expect(await approveChapter()).toBe(200)
    expect(mocks.approve).toHaveBeenCalledWith('reviewer', chapterId, 'approve', { notifyUser: false })
  })
})
