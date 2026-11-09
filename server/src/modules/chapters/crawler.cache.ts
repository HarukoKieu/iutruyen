import { randomUUID } from 'node:crypto'
import { redis } from '../../config/redis.js'
import { AppError } from '../../common/AppError.js'

export async function crawlerRedis<T>(operation: () => Promise<T>): Promise<T> {
  if (redis.status !== 'ready') throw new AppError(503, 'Crawler cần Redis hoạt động. Vui lòng thử lại sau.', 'CRAWLER_UNAVAILABLE')
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Redis deadline')), 2000)
    })])
  } catch {
    throw new AppError(503, 'Bộ nhớ tạm crawler không sẵn sàng. Vui lòng thử lại.', 'CRAWLER_UNAVAILABLE')
  } finally { clearTimeout(timer) }
}

export const crawlerCache = {
  async get<T>(key: string): Promise<T | null> {
    const value = await crawlerRedis(() => redis.get(`crawler:${key}`))
    return value ? JSON.parse(value) as T : null
  },
  async put(key: string, value: unknown, seconds = 1800) {
    await crawlerRedis(() => redis.set(`crawler:${key}`, JSON.stringify(value), 'EX', seconds))
  },
  async quota(userId: string) {
    const count = Number(await crawlerRedis(() => redis.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
      1, `crawler:quota:${userId}`)))
    if (count > 20) throw AppError.tooManyRequests('Tối đa 20 thao tác crawler/phút. Vui lòng đợi.', 'CRAWLER_QUOTA')
  },
  async withHost<T>(hostname: string, work: () => Promise<T>): Promise<T> {
    const key = `crawler:host:${hostname}`
    const token = randomUUID()
    const acquired = await crawlerRedis(() => redis.set(key, token, 'PX', 40000, 'NX'))
    if (!acquired) {
      const error = AppError.tooManyRequests('Nguồn đang được tải hoặc cần nghỉ 2 giây. Vui lòng thử lại.', 'CRAWLER_SOURCE_BUSY')
      const ttl = Number(await crawlerRedis(() => redis.eval("return redis.call('PTTL',KEYS[1])", 1, key)))
      error.retryAfterSeconds = Number.isFinite(ttl) ? Math.max(2, Math.min(3600, Math.ceil(ttl / 1000))) : 2
      throw error
    }
    let cooldown = 2000
    try { return await work() } catch (error) {
      if (error instanceof AppError && (error.code === 'CRAWLER_UPSTREAM_RATE_LIMITED' || error.code === 'CRAWLER_UPSTREAM_UNAVAILABLE')) {
        cooldown = Math.max(2000, Math.min(3600000, (error.retryAfterSeconds ?? 60) * 1000))
      }
      throw error
    } finally {
      await crawlerRedis(() => redis.eval(
        "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('PEXPIRE',KEYS[1],ARGV[2]) end; return 0",
        1, key, token, cooldown))
    }
  },
}
