import { Queue, type JobsOptions } from 'bullmq'
import { getBullMQConnectionOptions } from './connection.js'
import { defaultProductionJobOptions } from './base.queue.js'
import {
  QueueName,
  type EmailJobName,
  type EmailJobPayload,
  type VerificationEmailPayload,
  type PasswordResetEmailPayload,
  type GeneralEmailPayload,
} from './types.js'
import { logger } from '../common/logger.js'

export const emailQueue = new Queue<EmailJobPayload, any, EmailJobName>(QueueName.EMAIL, {
  connection: getBullMQConnectionOptions(),
  defaultJobOptions: defaultProductionJobOptions,
})

emailQueue.on('error', (err) => {
  logger.error('❌ BullMQ Email Queue Error:', err)
})

/**
 * Đẩy job gửi email xác thực tài khoản vào hàng đợi BullMQ.
 */
export const enqueueVerificationEmail = async (
  email: string,
  token: string,
  emailChange = false,
  customOptions?: JobsOptions
) => {
  const payload: VerificationEmailPayload = {
    type: 'verification',
    email,
    token,
    emailChange,
  }

  const job = await emailQueue.add('send_verification_email', payload, {
    priority: 1,
    ...customOptions,
  })

  logger.info(`[BullMQ] Enqueued verification email job #${job.id} for ${email}`)
  return job
}

/**
 * Đẩy job gửi email đặt lại mật khẩu vào hàng đợi BullMQ.
 */
export const enqueuePasswordResetEmail = async (
  email: string,
  token: string,
  customOptions?: JobsOptions
) => {
  const payload: PasswordResetEmailPayload = {
    type: 'password_reset',
    email,
    token,
  }

  const job = await emailQueue.add('send_password_reset_email', payload, {
    priority: 1,
    ...customOptions,
  })

  logger.info(`[BullMQ] Enqueued password reset email job #${job.id} for ${email}`)
  return job
}

/**
 * Đẩy job gửi email thông báo chung vào hàng đợi BullMQ.
 */
export const enqueueSendEmail = async (
  options: { to: string; subject: string; html: string },
  customOptions?: JobsOptions
) => {
  const payload: GeneralEmailPayload = {
    type: 'general',
    ...options,
  }

  const job = await emailQueue.add('send_general_email', payload, {
    priority: 2,
    ...customOptions,
  })

  logger.info(`[BullMQ] Enqueued general email job #${job.id} to ${options.to}`)
  return job
}
