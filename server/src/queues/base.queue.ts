import type { DefaultJobOptions } from 'bullmq'

/**
 * Production-ready Default Job Options:
 * 1. attempts: 3 lần thử lại nếu gặp lỗi (network, SMTP timeout, v.v.)
 * 2. backoff: exponential delay bắt đầu từ 2 giây (2s, 4s, 8s...) tránh DDOS tài nguyên đích
 * 3. removeOnComplete: Giới hạn lưu 2000 jobs hoặc tối đa 24h để ngăn tràn bộ nhớ Redis (OOM)
 * 4. removeOnFail: Giữ tối đa 5000 jobs lỗi trong 7 ngày để truy vết và phục hồi sự cố
 */
export const defaultProductionJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    age: 24 * 3600, // 24 giờ
    count: 2000,    // Giữ tối đa 2000 jobs đã hoàn thành
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // 7 ngày
    count: 5000,        // Giữ tối đa 5000 jobs lỗi
  },
}
