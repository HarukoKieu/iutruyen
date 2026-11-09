import { randomUUID } from 'node:crypto'
import { crawlerJobRepository } from '../repositories/crawler-job.repository.js'
import { createCrawlerJobProcessor } from '../modules/chapters/crawler-job.service.js'
import { AppError } from '../common/AppError.js'
import { logger } from '../common/logger.js'

/** Each claim has a fresh fence token. Paused/cancelled/reclaimed work cannot commit. */
export function createCrawlerImportWorker(repository = crawlerJobRepository, processor = createCrawlerJobProcessor(repository)) {
  let running: Promise<void> | undefined
  let controller: AbortController | undefined
  let stopped = false
  async function perform() {
    const owner = randomUUID()
    const job = await repository.claim(owner, 60000)
    if (!job) return
    const id = String(job._id)
    const local = new AbortController(); controller = local
    if (stopped) local.abort()
    let heartbeatFlight: Promise<void> | undefined
    let nextRunAt = new Date(Date.now() + 2100)
    const timer = setInterval(() => {
      if (heartbeatFlight) return
      heartbeatFlight = repository.heartbeat(id, owner, 60000)
        .then(ok => { if (!ok) local.abort() })
        .catch(() => local.abort())
        .finally(() => { heartbeatFlight = undefined })
    }, 10000)
    timer.unref()
    try {
      const budgetStarted = Date.now()
      // Already imported URLs need no upstream request. Drain a bounded group without host cooldown.
      for (let unit = 0; unit < 25; unit++) {
        const outcome = await processor.process(job, owner, local.signal)
        if (!outcome?.continueImmediately) break
        nextRunAt = new Date()
        if (Date.now() - budgetStarted >= 5000) break
      }
    } catch (error) {
      if (local.signal.aborted) return
      const failure = error instanceof AppError ? error : undefined
      if (failure?.code === 'CRAWLER_LEASE_LOST') return
      if (!failure || failure.code === 'CRAWLER_TASK_CONFLICT' || failure.statusCode === 429 || failure.statusCode === 503) {
        const delay = failure?.retryAfterSeconds ? failure.retryAfterSeconds * 1000 : failure?.code === 'CRAWLER_SOURCE_BUSY' ? 2100 : failure?.statusCode === 429 ? 60000 : 15000
        nextRunAt = new Date(Date.now() + delay)
      } else {
        await repository.failJob(id, owner, failure?.code ?? 'CRAWLER_WORKER_FAILED')
        logger.warn('crawler.batch.failed', { jobId: id, code: failure?.code ?? 'CRAWLER_WORKER_FAILED' })
      }
    } finally {
      clearInterval(timer)
      await heartbeatFlight
      controller = undefined
      await repository.release(id, owner, nextRunAt)
    }
  }
  return {
    tick() {
      if (stopped) return Promise.resolve()
      if (!running) running = perform().finally(() => { running = undefined })
      return running
    },
    async stop() { stopped = true; controller?.abort(); await running },
  }
}

let workers: ReturnType<typeof createCrawlerImportWorker>[] = []
let timer: NodeJS.Timeout | undefined
export async function startCrawlerImports() {
  await crawlerJobRepository.initialize()
  workers = [createCrawlerImportWorker(), createCrawlerImportWorker()]
  const tick = () => { for (const worker of workers) void worker.tick().catch(() => logger.error('Crawler worker unavailable', { code: 'CRAWLER_WORKER_UNAVAILABLE' })) }
  tick(); timer = setInterval(tick, 1000); timer.unref()
}
export async function stopCrawlerImports() {
  clearInterval(timer)
  await Promise.all(workers.map(worker => worker.stop()))
}
