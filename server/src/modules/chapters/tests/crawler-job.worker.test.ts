import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../repositories/crawler-job.repository.js', () => ({ crawlerJobRepository: {} }))
vi.mock('../crawler-job.service.js', () => ({ createCrawlerJobProcessor: vi.fn() }))
vi.mock('../../../common/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
import { createCrawlerImportWorker } from '../../../jobs/crawler-import.job.js'
import { crawlerJobRepository } from '../../../repositories/crawler-job.repository.js'
import { AppError } from '../../../common/AppError.js'
const repo = { claim: vi.fn(), heartbeat: vi.fn(), release: vi.fn(), failJob: vi.fn() }
const processor = { process: vi.fn() }
beforeEach(() => {
  vi.clearAllMocks(); repo.claim.mockResolvedValue({ _id: 'job' }); repo.heartbeat.mockResolvedValue(true)
  processor.process.mockReset().mockResolvedValue(undefined)
})
const make = () => createCrawlerImportWorker(repo as unknown as typeof crawlerJobRepository, processor)
describe('durable import worker lifecycle', () => {
  it('does not overlap ticks and uses a fresh owner for each claim', async () => {
    let finish!: () => void
    processor.process.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const worker = make(), first = worker.tick(), same = worker.tick()
    expect(same).toBe(first)
    await Promise.resolve(); finish(); await first; await worker.tick()
    expect(repo.claim).toHaveBeenCalledTimes(2)
    expect(repo.claim.mock.calls[0][0]).not.toBe(repo.claim.mock.calls[1][0])
    await worker.stop()
  })
  it('reschedules quota errors without marking the job failed', async () => {
    processor.process.mockRejectedValueOnce(AppError.tooManyRequests('Quota', 'CRAWLER_QUOTA'))
    const worker = make(), before = Date.now(); await worker.tick()
    expect(repo.failJob).not.toHaveBeenCalled()
    expect(repo.release.mock.calls[0][2].getTime()).toBeGreaterThanOrEqual(before + 59000)
    await worker.stop()
  })
  it('drains already-saved URLs in a bounded group without upstream cooldown', async () => {
    processor.process.mockResolvedValue({ continueImmediately: true })
    const worker = make(); await worker.tick()
    expect(processor.process).toHaveBeenCalledTimes(25)
    expect(repo.claim).toHaveBeenCalledTimes(1)
    await worker.stop()
  })
  it('fails revoked actors with a safe code', async () => {
    processor.process.mockRejectedValueOnce(AppError.forbidden('Revoked', 'CRAWLER_PERMISSION_CHANGED'))
    const worker = make(); await worker.tick()
    expect(repo.failJob).toHaveBeenCalledWith('job', expect.any(String), 'CRAWLER_PERMISSION_CHANGED')
    await worker.stop()
  })
  it('keeps work retryable after a transient database read failure', async () => {
    processor.process.mockRejectedValueOnce(new Error('Database unavailable'))
    const worker = make(), before = Date.now(); await worker.tick()
    expect(repo.failJob).not.toHaveBeenCalled()
    expect(repo.release.mock.calls[0][2].getTime()).toBeGreaterThanOrEqual(before + 14000)
    await worker.stop()
  })
  it('aborts in-flight work and accepts no new ticks after stop', async () => {
    processor.process.mockImplementationOnce(async (_job, _owner, signal: AbortSignal) => {
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }))
      signal.throwIfAborted()
    })
    const worker = make(), work = worker.tick(); await Promise.resolve(); await worker.stop(); await work; await worker.tick()
    expect(repo.claim).toHaveBeenCalledTimes(1); expect(repo.failJob).not.toHaveBeenCalled()
  })
})
