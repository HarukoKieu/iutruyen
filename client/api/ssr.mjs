import { readFile } from 'node:fs/promises'
import { createHmac, randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import { render } from '../.server/entry-server.js'

let templatePromise
function origin(value, local = false) {
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Invalid SEO origin')
  return url.origin
}
async function bounded(response, maxBytes) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Response budget exceeded')
  const chunks = []; let size = 0
  for await (const chunk of response.body ?? []) {
    size += chunk.byteLength
    if (size > maxBytes) throw new Error('Response budget exceeded')
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Robots-Tag', 'noindex')
  const requestId = randomUUID()
  res.setHeader('X-Request-Id', requestId)
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); res.statusCode = 405; res.end(); return }
  const send = (status, body, type = 'text/html; charset=utf-8') => { res.statusCode = status; res.setHeader('Content-Type', type); res.end(req.method === 'HEAD' ? undefined : body) }
  try {
    const local = process.env.NODE_ENV !== 'production'
    const site = origin(process.env.PUBLIC_SITE_URL || 'http://localhost:5173', local)
    const upstream = origin(process.env.SEO_API_ORIGIN || 'http://localhost:4000', local)
    const indexable = process.env.SEO_INDEXABLE === 'true'
    const url = new URL(req.url, site)
    // Never follow an absolute request target onto another host.
    if (url.origin !== site) { send(400, 'Invalid request target'); return }
    if (url.pathname === '/index.html') { res.setHeader('Location', '/'); send(308, ''); return }
    // Only canonicalize recognized public routes; preserve filters and private URLs.
    const canonicalPath = url.pathname.replace(/\/+$/, '')
    if (canonicalPath !== url.pathname && /^\/(stories|ranking)(?:\/[a-z0-9-]{1,200}(?:\/chapters\/[a-z0-9-]{1,512})?)?$/.test(canonicalPath) &&
      (canonicalPath === '/ranking' || canonicalPath.startsWith('/stories'))) {
      res.setHeader('Location', canonicalPath + url.search); send(308, ''); return
    }
    const signal = AbortSignal.timeout(5000)
    const secret = process.env.SSR_SIGNING_SECRET || ''
    const peer = req.socket?.remoteAddress || ''
    const trusted = (process.env.SSR_TRUSTED_PROXIES || '').split(',').map(value => value.trim()).filter(Boolean)
    // Forwarded addresses are accepted only from explicitly configured ingress peers.
    const forwarded = typeof req.headers?.['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',').map(value => value.trim()) : []
    let clientIp = peer
    if (trusted.includes(peer)) {
      for (let i = forwarded.length - 1; i >= 0; i--) {
        if (!isIP(forwarded[i])) break
        clientIp = forwarded[i]
        if (!trusted.includes(clientIp)) break
      }
    }
    const get = path => {
      const target = '/api/v1/seo' + path
      const headers = { 'X-Request-Id': requestId }
      if (secret.length >= 32 && isIP(clientIp)) {
        const timestamp = String(Math.floor(Date.now() / 1000))
        const principal = createHmac('sha256', secret).update(clientIp).digest('hex')
        headers['X-SSR-Time'] = timestamp
        headers['X-SSR-Client'] = principal
        headers['X-SSR-Signature'] = createHmac('sha256', secret).update(`${timestamp}\n${principal}\n${target}`).digest('hex')
      }
      return fetch(upstream + target, { redirect: 'error', signal, headers })
    }
    const proxyPath = url.pathname === '/sitemap.xml' || /^\/sitemaps\/[a-f0-9]{16}\/(stories|chapters)\/\d+\.xml$/.test(url.pathname)
      ? url.pathname : /^\/seo\/covers\/[a-f0-9]{24}$/i.test(url.pathname) ? url.pathname.slice(4) : null
    if (url.pathname === '/robots.txt') {
      send(200, indexable ? `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n` : 'User-agent: *\nAllow: /\n', 'text/plain; charset=utf-8'); return
    }
    if (proxyPath) {
      const response = await get(proxyPath)
      if (response.status === 429 || response.status === 503) res.setHeader('Retry-After', '60')
      const body = await bounded(response, 10 * 1024 * 1024)
      send(response.status, body, response.headers.get('content-type') || 'application/octet-stream'); return
    }
    const result = await render(url.href, async path => {
      const response = await get(path)
      const bytes = await bounded(response, 8 * 1024 * 1024)
      if (!response.ok) return new Response(bytes, { status: response.status })
      const body = JSON.parse(bytes.toString('utf8'))
      if (body.data?.meta) {
        if (new URL(body.data.meta.canonical).origin !== site) throw new Error('Canonical origin mismatch')
        body.data.meta.indexable = indexable && body.data.meta.indexable
      }
      return Response.json(body)
    })
    if (result.status === 503 || result.status === 429) res.setHeader('Retry-After', '60')
    if (!result.head.includes('content="noindex,follow"')) res.removeHeader('X-Robots-Tag')
    templatePromise ??= readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
    const template = await templatePromise
    const html = template.replace(/<meta name="robots"[^>]*data-shell="true"[^>]*>/, '')
      .replace('<meta name="ssr-head">', () => result.head + `<meta name="seo-indexable" content="${indexable}">`)
      .replace('<!--ssr-outlet-->', () => result.html)
      .replace('</body>', () => (result.state ? `<script id="ssr-state" type="application/json">${result.state}</script>` : '') + '</body>')
    send(result.status, html)
  } catch {
    // Do not include upstream payload, credentials or reader content in logs.
    console.error('SSR request failed', { requestId })
    res.setHeader('Retry-After', '60')
    send(503, '<!doctype html><html lang="vi"><head><meta name="robots" content="noindex"><title>Tạm thời gián đoạn — iutruyen</title></head><body><h1>Vui lòng thử lại sau</h1></body></html>')
  }
}
