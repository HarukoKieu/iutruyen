import { createHash } from 'node:crypto'
import { redis } from '../config/redis.js'
import { logger } from './logger.js'

/** At most one view per resource/IP/minute across processes. Never store raw IPs.
 * Missing identity or Redis failures skip analytics without blocking free reading.
 * This limits simple replay, not distributed bots; shared NATs may undercount.
 */
export async function recordReadView(resource: string, visitor: string | undefined, increment: () => Promise<unknown>): Promise<boolean> {
  if (!visitor || redis.status !== 'ready') return false
  const identity = createHash('sha256').update(visitor).digest('hex')
  try {
    if (await redis.set(`read-view:${resource}:${identity}`, '1', 'EX', 60, 'NX') !== 'OK') return false
    await increment()
    return true
  } catch {
    logger.warn('Read view was not recorded', { resource })
    return false
  }
}
