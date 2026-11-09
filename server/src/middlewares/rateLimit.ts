import { Request, Response, NextFunction } from 'express'
import { redis } from '../config/redis.js'
import { AppError } from '../common/AppError.js'
import { logger } from '../common/logger.js'
export interface RateLimitOptions {
  windowSeconds: number
  maxRequests: number
  prefix?: string
  keyGenerator?: (req: Request) => string
  message?: string
}
export const RATE_LIMIT_SCRIPT = `local count = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('TTL', KEYS[1])}`
/** A Redis outage must not disable protection of a guarded route. */
export const rateLimit = (options: RateLimitOptions) => {
  const { windowSeconds, maxRequests, prefix = 'rl',
    keyGenerator = (req) => req.ip || req.socket.remoteAddress || 'unknown',
    message = 'Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau' } = options
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (redis.status !== 'ready') throw new Error('Redis unavailable')
      const key = `ratelimit:${prefix}:${keyGenerator(req)}`
      const [current, ttl] = await redis.eval(RATE_LIMIT_SCRIPT, 1, key, windowSeconds) as [number, number]
      if (current > maxRequests) {
        res.setHeader('Retry-After', String(Math.max(1, ttl)))
        return next(AppError.tooManyRequests(message))
      }
      next()
    } catch (error) {
      logger.error('Rate limiter unavailable', { requestId: req.id, prefix, error: error instanceof Error ? error.message : 'unknown' })
      next(new AppError(503, 'Dịch vụ tạm thời không khả dụng, vui lòng thử lại', 'RATE_LIMIT_UNAVAILABLE'))
    }
  }
}
