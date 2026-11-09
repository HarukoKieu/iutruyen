import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import { env } from '../config/env.js'

/** Only the server-side renderer holding the shared secret can assert a client key. */
export function seoRateIdentity(req: Request): string {
  const fallback = `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`
  const secret = env.SSR_SIGNING_SECRET
  const principal = req.get('X-SSR-Client'), timestamp = req.get('X-SSR-Time'), signature = req.get('X-SSR-Signature')
  if (!secret || secret.length < 32 || !principal || !/^[a-f\d]{64}$/.test(principal) ||
      !timestamp || !/^\d{10}$/.test(timestamp) || !signature || !/^[a-f\d]{64}$/.test(signature)) return fallback
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 30) return fallback
  const expected = createHmac('sha256', secret).update(`${timestamp}\n${principal}\n${req.originalUrl}`).digest()
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return fallback
  return `ssr:${principal}`
}
