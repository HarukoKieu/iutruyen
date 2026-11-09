import { Redis } from 'ioredis'
import { env } from './env.js'
import { logger } from '../common/logger.js'

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  tls: env.REDIS_TLS ? { servername: env.REDIS_HOST, rejectUnauthorized: true } : undefined,
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  commandTimeout: 3000,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
})

redis.on('connect', () => {
  logger.info('🔴 Redis Client Connected')
})

redis.on('error', (err) => {
  logger.error('❌ Redis Connection Error:', err)
})

export const connectRedis = async (): Promise<void> => {
  try {
    await redis.connect()
  } catch (error) {
    logger.error('❌ Redis initial connection failed:', error)
    throw error
  }
}
