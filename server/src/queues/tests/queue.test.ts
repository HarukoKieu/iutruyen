import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBullMQConnectionOptions } from '../connection.js'
import { defaultProductionJobOptions } from '../base.queue.js'
import {
  emailQueue,
  enqueueVerificationEmail,
  enqueuePasswordResetEmail,
  enqueueSendEmail,
} from '../email.queue.js'
import { queueManager } from '../queue.manager.js'

describe('BullMQ Configuration & Setup', () => {
  it('should have valid production connection options with maxRetriesPerRequest: null', () => {
    const opts = getBullMQConnectionOptions()
    expect(opts.maxRetriesPerRequest).toBeNull()
    expect(opts.enableReadyCheck).toBe(false)
    expect(opts.host).toBeDefined()
    expect(opts.port).toBeDefined()
    if (typeof opts.retryStrategy === 'function') {
      expect(opts.retryStrategy(1)).toBe(100)
      expect(opts.retryStrategy(50)).toBe(3000)
    }
  })

  it('should enforce production memory-safe retention policies and retry backoff', () => {
    expect(defaultProductionJobOptions.attempts).toBe(3)
    expect(defaultProductionJobOptions.backoff).toEqual({
      type: 'exponential',
      delay: 2000,
    })
    expect(defaultProductionJobOptions.removeOnComplete).toEqual({
      age: 86400,
      count: 2000,
    })
    expect(defaultProductionJobOptions.removeOnFail).toEqual({
      age: 7 * 86400,
      count: 5000,
    })
  })
})

describe('Email Queue Producers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should enqueue verification email with priority 1 and correct payload', async () => {
    const addSpy = vi.spyOn(emailQueue, 'add').mockResolvedValue({ id: 'job-123' } as any)

    const job = await enqueueVerificationEmail('user@test.com', 'token-abc', true)

    expect(job.id).toBe('job-123')
    expect(addSpy).toHaveBeenCalledWith(
      'send_verification_email',
      {
        type: 'verification',
        email: 'user@test.com',
        token: 'token-abc',
        emailChange: true,
      },
      expect.objectContaining({
        priority: 1,
      })
    )
  })

  it('should enqueue password reset email with correct payload', async () => {
    const addSpy = vi.spyOn(emailQueue, 'add').mockResolvedValue({ id: 'job-456' } as any)

    const job = await enqueuePasswordResetEmail('user@test.com', 'reset-token')

    expect(job.id).toBe('job-456')
    expect(addSpy).toHaveBeenCalledWith(
      'send_password_reset_email',
      {
        type: 'password_reset',
        email: 'user@test.com',
        token: 'reset-token',
      },
      expect.objectContaining({
        priority: 1,
      })
    )
  })

  it('should enqueue general email with correct payload', async () => {
    const addSpy = vi.spyOn(emailQueue, 'add').mockResolvedValue({ id: 'job-789' } as any)

    const job = await enqueueSendEmail({
      to: 'recipient@test.com',
      subject: 'Notification',
      html: '<p>Hello</p>',
    })

    expect(job.id).toBe('job-789')
    expect(addSpy).toHaveBeenCalledWith(
      'send_general_email',
      {
        type: 'general',
        to: 'recipient@test.com',
        subject: 'Notification',
        html: '<p>Hello</p>',
      },
      expect.objectContaining({
        priority: 2,
      })
    )
  })
})

describe('Queue Manager Lifecycle & Health', () => {
  it('should manage lifecycle and close cleanly', async () => {
    queueManager.init()
    const emailQ = queueManager.getQueue('email-queue')
    expect(emailQ).toBeDefined()

    await expect(queueManager.closeAll()).resolves.toBeUndefined()
  })
})
