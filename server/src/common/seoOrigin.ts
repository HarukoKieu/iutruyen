/** Canonicals must never inherit an untrusted request Host. */
export function seoOrigin(value: string, production = false): string {
  const url = new URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && !production))) {
    throw new Error('PUBLIC_SITE_URL must be an HTTPS origin (HTTP localhost allowed outside production)')
  }
  return url.origin
}
