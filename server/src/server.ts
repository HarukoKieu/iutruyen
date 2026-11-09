import http from 'http'
import app from './app.js'
import { env } from './config/env.js'
import { connectDB } from './config/db.js'
import mongoose from 'mongoose'
import { connectRedis, redis } from './config/redis.js'
import { initSocket, closeSocket } from './config/socket.js'
import { logger } from './common/logger.js'
import { startScheduledPublishingCron, waitForScheduledPublishing } from './jobs/publish-scheduled-chapters.job.js'
import { sitemapJob } from './jobs/sitemap-manifest.job.js'
import { startAdminMetrics, stopAdminMetrics } from './jobs/admin-metrics.job.js'
import { startLocalBackups, stopLocalBackups } from './jobs/local-backup.job.js'
import { startCrawlerImports, stopCrawlerImports } from './jobs/crawler-import.job.js'
import { setDraining } from './common/readiness.js'
import { genreRepository } from './repositories/genre.repository.js'
import { queueManager } from './queues/queue.manager.js'

const server = http.createServer(app)
let publishingTimer: NodeJS.Timeout | undefined
let stopping = false
const shutdown = async () => {
  if (stopping) return
  stopping = true
  setDraining()
  clearInterval(publishingTimer)
  // Abort subprocesses immediately, before draining HTTP and closing database connections.
  const backupsStopped = stopLocalBackups().then(() => undefined, () => new Error('Backup shutdown failed'))
  const crawlerStopped = stopCrawlerImports().then(() => undefined, () => new Error('Crawler shutdown failed'))
  const deadline = setTimeout(() => process.exit(1), 15000)
  deadline.unref()
  try {
    await closeSocket()
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await sitemapJob.stop()
    await waitForScheduledPublishing()
    await stopAdminMetrics()
    await queueManager.closeAll()
    const backupError = await backupsStopped
    if (backupError) throw backupError
    const crawlerError = await crawlerStopped
    if (crawlerError) throw crawlerError
    await mongoose.disconnect()
    if (redis.status === 'ready') await redis.quit()
    else redis.disconnect()
    clearTimeout(deadline)
    process.exitCode = 0
  } catch (error) { logger.error('Graceful shutdown failed', error); process.exit(1) }
}
process.once('SIGTERM', () => { void shutdown() })
process.once('SIGINT', () => { void shutdown() })

// Attach Socket.IO to HTTP server
initSocket(server)

const startServer = async (): Promise<void> => {
  try {
    // 1. Connect MongoDB
    await connectDB()

    // 2. Connect Redis
    await connectRedis()
    await genreRepository.seedDefaultGenresIfEmpty()

    // 3. Start Background Jobs
    publishingTimer = startScheduledPublishingCron(60000)
    await sitemapJob.start()
    startAdminMetrics()
    startLocalBackups()
    await startCrawlerImports()
    queueManager.init()

    // 4. Listen Port
    server.listen(env.PORT, () => {
      logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`)
    })
  } catch (error) {
    logger.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
