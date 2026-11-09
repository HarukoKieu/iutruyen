import type { Queue, Worker } from 'bullmq'
import { emailQueue } from './email.queue.js'
import { createEmailWorker } from './email.worker.js'
import { QueueName, type QueueHealthStats } from './types.js'
import { logger } from '../common/logger.js'

class QueueManager {
  private queues: Map<string, Queue> = new Map()
  private workers: Map<string, Worker> = new Map()
  private isInitialized = false

  public init() {
    if (this.isInitialized) return

    // Đăng ký các Queue
    this.queues.set(QueueName.EMAIL, emailQueue as unknown as Queue)

    // Khởi tạo và đăng ký các Workers
    const emailWorker = createEmailWorker()
    this.workers.set(QueueName.EMAIL, emailWorker as unknown as Worker)

    this.isInitialized = true
    logger.info(`🚀 [BullMQ] Initialized ${this.queues.size} queues and ${this.workers.size} workers`)
  }

  /**
   * Graceful shutdown:
   * 1. Đóng Workers trước để dừng nhận jobs mới và chờ các jobs đang chạy dở hoàn tất (drain)
   * 2. Đóng Queues để giải phóng kết nối Redis
   */
  public async closeAll(): Promise<void> {
    if (!this.isInitialized && this.workers.size === 0 && this.queues.size === 0) return

    logger.info('⏳ [BullMQ] Closing all workers and queues gracefully...')

    const workerClosePromises = Array.from(this.workers.entries()).map(async ([name, worker]) => {
      try {
        await worker.close()
        logger.info(`🛑 [BullMQ] Worker [${name}] closed`)
      } catch (err) {
        logger.error(`❌ [BullMQ] Error closing worker [${name}]:`, err)
      }
    })
    await Promise.all(workerClosePromises)
    this.workers.clear()

    const queueClosePromises = Array.from(this.queues.entries()).map(async ([name, queue]) => {
      try {
        await queue.close()
        logger.info(`🛑 [BullMQ] Queue [${name}] closed`)
      } catch (err) {
        logger.error(`❌ [BullMQ] Error closing queue [${name}]:`, err)
      }
    })
    await Promise.all(queueClosePromises)
    this.queues.clear()

    this.isInitialized = false
    logger.info('✅ [BullMQ] All queues and workers have been stopped cleanly')
  }

  /**
   * Giám sát sức khỏe và số lượng jobs trong queue chuẩn production
   */
  public async getStats(): Promise<QueueHealthStats[]> {
    const results: QueueHealthStats[] = []
    for (const [name, queue] of this.queues.entries()) {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
        const isPaused = await queue.isPaused()
        results.push({
          queueName: name,
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
          paused: isPaused,
        })
      } catch (err) {
        logger.error(`[BullMQ] Failed to get stats for queue [${name}]:`, err)
      }
    }
    return results
  }

  public getQueue(name: string): Queue | undefined {
    return this.queues.get(name)
  }
}

export const queueManager = new QueueManager()
