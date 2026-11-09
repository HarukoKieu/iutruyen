import { Worker, type Job } from 'bullmq'
import { getBullMQConnectionOptions } from './connection.js'
import { QueueName, type EmailJobName, type EmailJobPayload } from './types.js'
import { sendEmail, sendVerificationEmail, sendPasswordResetEmail } from '../emails/mailer.js'
import { logger } from '../common/logger.js'

export const createEmailWorker = (concurrency = 5): Worker<EmailJobPayload, any, EmailJobName> => {
  const worker = new Worker<EmailJobPayload, any, EmailJobName>(
    QueueName.EMAIL,
    async (job: Job<EmailJobPayload, any, EmailJobName>) => {
      logger.info(`[BullMQ:EmailWorker] Processing job #${job.id} (name: ${job.name}, attempt: ${job.attemptsMade + 1})`)
      const data = job.data

      let success = false
      switch (data.type) {
        case 'verification':
          success = await sendVerificationEmail(data.email, data.token, data.emailChange)
          break
        case 'password_reset':
          success = await sendPasswordResetEmail(data.email, data.token)
          break
        case 'general':
          success = await sendEmail({
            to: data.to,
            subject: data.subject,
            html: data.html,
          })
          break
        default:
          throw new Error(`Unknown email job type: ${(data as unknown as { type: string }).type}`)
      }

      if (!success) {
        // Ném lỗi để BullMQ kích hoạt retry theo exponential backoff
        throw new Error(`Email delivery returned false for job #${job.id} (type: ${data.type})`)
      }

      return { status: 'sent', timestamp: new Date().toISOString() }
    },
    {
      connection: getBullMQConnectionOptions(),
      concurrency,
      // Thời gian kiểm tra job bị treo (stalled) mặc định 30s
      stalledInterval: 30000,
    }
  )

  worker.on('completed', (job) => {
    logger.info(`✅ [BullMQ:EmailWorker] Job #${job.id} (${job.name}) completed successfully`)
  })

  worker.on('failed', (job, err) => {
    if (job) {
      const attemptsLeft = (job.opts.attempts || 1) - job.attemptsMade
      logger.error(`❌ [BullMQ:EmailWorker] Job #${job.id} (${job.name}) failed: ${err.message}. Retries left: ${Math.max(0, attemptsLeft)}`, {
        jobId: job.id,
        attemptsMade: job.attemptsMade,
        error: err.stack,
      })
    } else {
      logger.error('❌ [BullMQ:EmailWorker] Job failed with null job reference:', err)
    }
  })

  worker.on('stalled', (jobId) => {
    logger.warn(`⚠️ [BullMQ:EmailWorker] Job #${jobId} stalled and will be re-processed`)
  })

  worker.on('error', (err) => {
    logger.error('❌ [BullMQ:EmailWorker] Worker connection/internal error:', err)
  })

  return worker
}
