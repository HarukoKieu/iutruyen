import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
const state = vi.hoisted(() => ({ mongo: { readyState: 1, db: { admin: () => ({ ping: state.mongoPing }) } }, mongoPing: vi.fn(), redis: { status: 'ready', ping: vi.fn() } }))
vi.mock('mongoose', () => ({ default: { connection: state.mongo } }))
vi.mock('../../config/redis.js', () => ({ redis: state.redis }))
import { readiness, setDraining } from '../readiness.js'
beforeEach(() => { vi.resetAllMocks(); setDraining(false); state.mongo.readyState = 1; state.redis.status = 'ready' })
async function probe() {
  const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
  await readiness({} as Request, res, vi.fn() as NextFunction)
  return res
}
describe('dependency readiness', () => {
  it('returns 200 only with usable dependencies', async () => {
    expect((await probe()).status).toHaveBeenCalledWith(200)
    state.redis.ping.mockRejectedValueOnce(new Error('offline'))
    expect((await probe()).status).toHaveBeenCalledWith(503)
    state.mongo.readyState = 0
    expect((await probe()).status).toHaveBeenCalledWith(503)
  })
  it('marks draining processes unavailable without issuing probes', async () => {
    setDraining()
    expect((await probe()).status).toHaveBeenCalledWith(503)
    expect(state.redis.ping).not.toHaveBeenCalled()
  })
  it('bounds hanging probes', async () => {
    vi.useFakeTimers()
    try {
      state.redis.ping.mockImplementation(() => new Promise(() => {}))
      const request = probe()
      await vi.advanceTimersByTimeAsync(1500)
      expect((await request).status).toHaveBeenCalledWith(503)
    } finally { vi.useRealTimers() }
  })
})
