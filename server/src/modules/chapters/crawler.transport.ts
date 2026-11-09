import { resolve4 } from 'node:dns/promises'
import { request } from 'node:https'
import { isIPv4 } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { AppError } from '../../common/AppError.js'
import { crawlerCache } from './crawler.cache.js'
import { assertRobotsAllowed } from './crawler.robots.js'

export function crawlerRetrySeconds(header: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(header) ? header[0] : header
  const seconds = raw && /^\d+$/.test(raw.trim()) ? Number(raw) : raw ? Math.ceil((Date.parse(raw) - Date.now()) / 1000) : fallback
  return Number.isFinite(seconds) ? Math.max(2, Math.min(3600, seconds)) : fallback
}

export function isPublicIPv4(ip: string) {
  if (!isIPv4(ip)) return false
  const [a, b, c] = ip.split('.').map(Number)
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113))
}

/** Resolve public IPv4 once and pin it to HTTPS; TLS still verifies the original hostname. */
export async function fetchSourcePage(url: URL, robots = false, image = false, abortSignal?: AbortSignal): Promise<string | null> {
  abortSignal?.throwIfAborted()
  const signal = abortSignal ? AbortSignal.any([AbortSignal.timeout(15000), abortSignal]) : AbortSignal.timeout(15000)
  try {
    const addresses = await new Promise<string[]>((resolve, reject) => {
      const abort = () => reject(new Error('DNS deadline'))
      if (signal.aborted) { reject(new Error('DNS deadline')); return }
      signal.addEventListener('abort', abort, { once: true })
      resolve4(url.hostname).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    })
    if (signal.aborted) throw new Error('Deadline')
    if (!addresses.length || addresses.some(ip => !isPublicIPv4(ip))) {
      throw AppError.badRequest('DNS của nguồn không phải địa chỉ Internet công khai', 'CRAWLER_DNS')
    }
    return await new Promise<string | null>((resolve, reject) => {
      const req = request(url, {
        method: 'GET', agent: false, signal, family: 4,
        lookup: (_host, _options, callback) => callback(null, addresses[0], 4),
        headers: { 'User-Agent': 'IutruyenCrawler/1.0', Accept: robots ? 'text/plain' : image ? 'image/png,image/jpeg,image/webp,image/gif' : 'text/html', 'Accept-Encoding': 'identity' },
      }, response => {
        const status = response.statusCode ?? 0
        const fail = (message: string) => { response.destroy(); reject(new AppError(502, message, 'CRAWLER_SOURCE_RESPONSE')) }
        if (robots && status === 404) { response.destroy(); resolve(null); return }
        if (status === 429 || status === 503) {
          response.destroy()
          const error = new AppError(status, 'Nguồn đang giới hạn tải hoặc tạm thời không khả dụng. Crawler sẽ đợi trước khi thử lại.',
            status === 429 ? 'CRAWLER_UPSTREAM_RATE_LIMITED' : 'CRAWLER_UPSTREAM_UNAVAILABLE')
          error.retryAfterSeconds = crawlerRetrySeconds(response.headers['retry-after'], status === 429 ? 60 : 30)
          reject(error); return
        }
        if (status !== 200) { fail(`Nguồn trả HTTP ${status}. Crawler không tự đi theo chuyển hướng.`); return }
        const contentType = response.headers['content-type'] ?? ''
        if (!(robots ? /^text\/plain\b/i : image ? /^image\/(png|jpeg|webp|gif)\s*(;|$)/i : /^text\/html\b/i).test(contentType)) {
          fail('Nguồn không trả đúng loại văn bản được hỗ trợ'); return
        }
        if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
          fail('Nguồn gửi nội dung nén không được hỗ trợ'); return
        }
        const chunks: Buffer[] = []
        let bytes = 0
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes > (robots ? 128 * 1024 : image ? 500 * 1024 : 1024 * 1024)) { fail('Nội dung tải vượt giới hạn kích thước'); return }
          chunks.push(chunk)
        })
        response.on('error', reject)
        response.on('end', () => {
          if (image) {
            const body = Buffer.concat(chunks)
            const mime = contentType.split(';')[0].trim().toLowerCase()
            const valid = mime === 'image/png' ? body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
              : mime === 'image/jpeg' ? body[0] === 255 && body[1] === 216 && body[2] === 255
                : mime === 'image/gif' ? /^GIF8[79]a/.test(body.subarray(0, 6).toString())
                  : body.subarray(0, 4).toString() === 'RIFF' && body.subarray(8, 12).toString() === 'WEBP'
            if (!valid) { fail('Dữ liệu ảnh bìa không hợp lệ'); return }
            resolve(`data:${mime};base64,${body.toString('base64')}`); return
          }
          const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1] ?? 'utf-8'
          try { resolve(new TextDecoder(charset, { fatal: true }).decode(Buffer.concat(chunks))) }
          catch { fail('Bảng mã văn bản không được hỗ trợ hoặc dữ liệu không hợp lệ') }
        })
      })
      req.on('error', reject)
      req.end()
    })
  } catch (error) {
    if (abortSignal?.aborted) throw abortSignal.reason
    if (error instanceof AppError) throw error
    throw new AppError(502, signal.aborted ? 'Nguồn phản hồi quá 15 giây' : 'Không thể kết nối an toàn tới nguồn', 'CRAWLER_FETCH_FAILED')
  }
}

export async function fetchCrawlerHtml(url: URL, image = false, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted()
  return crawlerCache.withHost(url.hostname, async () => {
    let robots = await crawlerCache.get<{ body: string }>(`robots:${url.hostname}`)
    if (!robots) {
      robots = { body: (await fetchSourcePage(new URL('/robots.txt', url), true, false, signal)) ?? '' }
      await crawlerCache.put(`robots:${url.hostname}`, robots, 300)
      await delay(2100, undefined, { signal })
    }
    assertRobotsAllowed(robots.body, url)
    signal?.throwIfAborted()
    return (await fetchSourcePage(url, false, image, signal))!
  })
}
