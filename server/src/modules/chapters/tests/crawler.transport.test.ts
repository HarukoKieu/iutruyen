import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ dns: vi.fn(), request: vi.fn() }))
vi.mock('node:dns/promises', () => ({ resolve4: mocks.dns }))
vi.mock('node:https', () => ({ request: mocks.request }))
vi.mock('../crawler.cache.js', () => ({ crawlerCache: {} }))
import { fetchSourcePage, isPublicIPv4, crawlerRetrySeconds } from '../crawler.transport.js'

const url = new URL('https://books.example.org/chapter')
function response(status = 200, body: string | Buffer = '<h1>OK</h1>', headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' }) {
  mocks.request.mockImplementation((_url, _options, callback) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void }
    req.end = () => queueMicrotask(() => {
      const res = Object.assign(new EventEmitter(), { statusCode: status, headers, destroy: vi.fn() })
      callback(res)
      res.emit('data', Buffer.from(body)); res.emit('end')
    })
    return req
  })
}
beforeEach(() => { vi.clearAllMocks(); mocks.dns.mockResolvedValue(['93.184.216.34']); response() })
describe('crawler network boundary', () => {
  it('returns a bounded raster cover as base64 and rejects fake images and SVG', async () => {
    const png = Buffer.from([137,80,78,71,13,10,26,10])
    response(200, png, { 'content-type': 'image/png' })
    await expect(fetchSourcePage(url, false, true)).resolves.toBe(`data:image/png;base64,${png.toString('base64')}`)
    response(200, '<script>not an image</script>', { 'content-type': 'image/jpeg' })
    await expect(fetchSourcePage(url, false, true)).rejects.toThrow(/ảnh bìa/)
    response(200, '<svg/>', { 'content-type': 'image/svg+xml' })
    await expect(fetchSourcePage(url, false, true)).rejects.toThrow()
    response(200, Buffer.alloc(500 * 1024 + 1), { 'content-type': 'image/png' })
    await expect(fetchSourcePage(url, false, true)).rejects.toThrow(/kích thước/)
  })
  it.each(['127.0.0.1', '10.0.0.1', '0.0.0.0', '169.254.169.254', '172.16.0.1', '192.168.0.1', '100.64.0.1', '198.18.0.1', '192.0.2.1', '203.0.113.2', '224.0.0.1', '::1', '::ffff:127.0.0.1'])('rejects non-public address %s', ip => {
    expect(isPublicIPv4(ip)).toBe(false)
  })
  it('rejects mixed DNS answers before making a connection', async () => {
    mocks.dns.mockResolvedValue(['93.184.216.34', '127.0.0.1'])
    await expect(fetchSourcePage(url)).rejects.toMatchObject({ code: 'CRAWLER_DNS' })
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('pins the validated address without another DNS lookup and sends no credentials', async () => {
    await expect(fetchSourcePage(url)).resolves.toBe('<h1>OK</h1>')
    const options = mocks.request.mock.calls[0][1]
    mocks.dns.mockResolvedValue(['127.0.0.1'])
    const callback = vi.fn()
    options.lookup(url.hostname, {}, callback)
    expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4)
    expect(mocks.dns).toHaveBeenCalledTimes(1)
    expect(options.headers).not.toHaveProperty('Cookie')
    expect(options.headers).not.toHaveProperty('Authorization')
    expect(options.agent).toBe(false)
  })
  it.each([301, 302, 307, 403, 500])('never follows HTTP %s', async status => {
    response(status)
    await expect(fetchSourcePage(url)).rejects.toMatchObject({ code: 'CRAWLER_SOURCE_RESPONSE' })
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
  it.each([429, 503])('reschedules upstream HTTP %s according to Retry-After', async status => {
    response(status, '', { 'content-type': 'text/html', 'retry-after': '120' })
    await expect(fetchSourcePage(url)).rejects.toMatchObject({ statusCode: status, retryAfterSeconds: 120 })
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
  it('bounds untrusted Retry-After and accepts HTTP dates', () => {
    expect(crawlerRetrySeconds('999999999', 60)).toBe(3600)
    expect(crawlerRetrySeconds('invalid', 60)).toBe(60)
    expect(crawlerRetrySeconds(new Date(Date.now() + 90000).toUTCString(), 60)).toBeGreaterThanOrEqual(89)
  })
  it('only treats robots 404 as an absent policy', async () => {
    response(404)
    await expect(fetchSourcePage(url, true)).resolves.toBeNull()
    await expect(fetchSourcePage(url)).rejects.toThrow()
  })
  it('rejects large responses and unexpected content types', async () => {
    response(200, 'x'.repeat(1024 * 1024 + 1))
    await expect(fetchSourcePage(url)).rejects.toThrow(/kích thước/)
    response(200, '{}', { 'content-type': 'application/json' })
    await expect(fetchSourcePage(url)).rejects.toThrow(/loại văn bản/)
  })
  it('bounds DNS resolution by the same total deadline', async () => {
    const controller = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    mocks.dns.mockReturnValue(new Promise(() => {}))
    const result = fetchSourcePage(url)
    const assertion = expect(result).rejects.toThrow(/15 giây/)
    controller.abort()
    await assertion
    timeout.mockRestore()
    expect(mocks.request).not.toHaveBeenCalled()
  })
})
