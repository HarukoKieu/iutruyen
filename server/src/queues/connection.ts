import type { RedisOptions } from 'bullmq'
import { env } from '../config/env.js'

/**
 * Cấu hình kết nối Redis dành riêng cho BullMQ.
 * Lưu ý quan trọng chuẩn production:
 * - maxRetriesPerRequest BẮT BUỘC phải là null theo yêu cầu của BullMQ
 * - enableReadyCheck tắt để tránh conflict kiểm tra lệnh INFO lúc khởi tạo
 * - retryStrategy với exponential backoff giới hạn trần 3s để tự phục hồi kết nối
 */
export const getBullMQConnectionOptions = (): RedisOptions => {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? { servername: env.REDIS_HOST, rejectUnauthorized: true } : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      const delay = Math.min(times * 100, 3000)
      return delay
    },
  }
}
