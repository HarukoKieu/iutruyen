/**
 * XML Builder — Phase 8
 * Utility xây dựng sitemap XML an toàn, escape đúng chuẩn.
 * Không nối chuỗi JSON thủ công — dùng escape function cho mọi user data.
 */

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>'

/**
 * Escape các ký tự đặc biệt XML trong URL/text.
 * Quan trọng: phải escape trước khi nhúng vào <loc> hoặc attribute.
 */
const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Build sitemap index XML từ danh sách <sitemap> entries đã được format sẵn.
 * Mỗi entry là một chuỗi như: `  <sitemap><loc>...</loc></sitemap>`
 */
const buildSitemapIndex = (entries: string[]): string => {
  return [
    XML_HEADER,
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</sitemapindex>',
  ].join('\n')
}

/**
 * Build urlset XML từ danh sách <url> entries đã được format sẵn.
 * Mỗi entry là một chuỗi như: `  <url><loc>...</loc></url>`
 */
const buildUrlSet = (entries: string[]): string => {
  return [
    XML_HEADER,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
  ].join('\n')
}

/**
 * Serialize JSON-LD object an toàn để nhúng vào <script type="application/ld+json">.
 * Escape </script> và các ký tự nguy hiểm để tránh breakout XSS.
 */
const safeJsonLd = (obj: object): string => {
  const json = JSON.stringify(obj)
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
}

export const xmlBuilder = {
  escapeXml,
  buildSitemapIndex,
  buildUrlSet,
  safeJsonLd,
}
