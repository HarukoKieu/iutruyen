import mongoose from 'mongoose'
import { redis } from '../config/redis.js'
import type { RequestHandler } from 'express'
import { ApiResponse } from './ApiResponse.js'

let draining = false
export const setDraining = (value = true) => { draining = value }

/** Dependency probes have a fixed budget and never expose connection details. */
export const readiness: RequestHandler = async (_req, res) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  let dependenciesReady = false
  if (!draining && mongoose.connection.readyState === 1 && redis.status === 'ready') {
    try {
      dependenciesReady = await Promise.race([
        Promise.all([mongoose.connection.db!.admin().ping(), redis.ping()]).then(() => true),
        new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 1500) }),
      ])
    } catch { /* An unavailable dependency makes the process unready. */ }
    finally { clearTimeout(timer) }
  }
  const ready = dependenciesReady && !draining
  res.setHeader('Cache-Control', 'no-store')
  ApiResponse.success(res, { status: ready ? 'ok' : 'unavailable' }, { statusCode: ready ? 200 : 503 })
}
