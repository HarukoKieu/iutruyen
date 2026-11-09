import { adminRepository } from '../repositories/admin.repository.js'
import { logger } from '../common/logger.js'

let timer: NodeJS.Timeout | undefined
let running: Promise<void> | undefined
/** Idempotent hourly samples, bounded query budget, no overlapping work per process. */
export function startAdminMetrics() {
  const tick = () => {
    if (running) return
    running = adminRepository.sampleMetrics().catch(error => { logger.error('Admin metric sampling failed', { error: error instanceof Error ? error.message : 'unknown' }) }).finally(() => { running = undefined })
  }
  tick()
  timer = setInterval(tick, 60000)
  timer.unref()
}
export async function stopAdminMetrics() { clearInterval(timer); await running }
