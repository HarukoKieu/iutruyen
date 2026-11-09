/**
 * XML Builder Tests — Phase 8
 * Kiểm tra escape, build sitemap index, urlset và JSON-LD safety.
 */
import { describe, it, expect } from 'vitest'
import { xmlBuilder } from '../../../common/xmlBuilder.js'

describe('xmlBuilder.escapeXml', () => {
  it('escapes ampersand', () => {
    expect(xmlBuilder.escapeXml('a&b')).toBe('a&amp;b')
  })

  it('escapes less-than and greater-than', () => {
    expect(xmlBuilder.escapeXml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes double and single quotes', () => {
    expect(xmlBuilder.escapeXml('"hello"')).toBe('&quot;hello&quot;')
    expect(xmlBuilder.escapeXml("it's")).toBe('it&apos;s')
  })

  it('handles combined special chars', () => {
    expect(xmlBuilder.escapeXml('a < b & c > "d"')).toBe(
      'a &lt; b &amp; c &gt; &quot;d&quot;'
    )
  })

  it('does not modify safe strings', () => {
    const safe = 'truyen-test-123'
    expect(xmlBuilder.escapeXml(safe)).toBe(safe)
  })

  it('handles Vietnamese characters without escaping', () => {
    const vn = 'Truyện Tiên Hiệp'
    expect(xmlBuilder.escapeXml(vn)).toBe(vn)
  })

  it('handles emoji', () => {
    const emoji = '👑 Truyện hay'
    expect(xmlBuilder.escapeXml(emoji)).toBe(emoji)
  })
})

describe('xmlBuilder.buildSitemapIndex', () => {
  it('builds valid XML with header and sitemapindex tag', () => {
    const entries = [
      '  <sitemap><loc>https://iutruyen.vn/sitemaps/abc/stories/0.xml</loc></sitemap>',
    ]
    const xml = xmlBuilder.buildSitemapIndex(entries)

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<sitemapindex')
    expect(xml).toContain('</sitemapindex>')
    expect(xml).toContain('https://iutruyen.vn/sitemaps/abc/stories/0.xml')
  })

  it('builds empty sitemapindex for empty entries', () => {
    const xml = xmlBuilder.buildSitemapIndex([])
    expect(xml).toContain('<sitemapindex')
    expect(xml).toContain('</sitemapindex>')
    // Không có <sitemap>
    expect(xml).not.toContain('<sitemap>')
  })

  it('includes all entries', () => {
    const entries = [
      '  <sitemap><loc>https://example.com/s0.xml</loc></sitemap>',
      '  <sitemap><loc>https://example.com/s1.xml</loc></sitemap>',
      '  <sitemap><loc>https://example.com/c0.xml</loc></sitemap>',
    ]
    const xml = xmlBuilder.buildSitemapIndex(entries)
    expect(xml).toContain('s0.xml')
    expect(xml).toContain('s1.xml')
    expect(xml).toContain('c0.xml')
  })

  it('is valid parseable XML structure (no unclosed tags)', () => {
    const entries = ['  <sitemap><loc>https://example.com/s0.xml</loc></sitemap>']
    const xml = xmlBuilder.buildSitemapIndex(entries)
    // Basic structural checks
    expect(xml.indexOf('<sitemapindex')).toBeLessThan(xml.indexOf('</sitemapindex>'))
  })
})

describe('xmlBuilder.buildUrlSet', () => {
  it('builds valid urlset XML', () => {
    const entries = [
      '  <url><loc>https://iutruyen.vn/stories/truyen-test</loc></url>',
    ]
    const xml = xmlBuilder.buildUrlSet(entries)

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset')
    expect(xml).toContain('</urlset>')
    expect(xml).toContain('truyen-test')
  })

  it('builds empty urlset for zero entries', () => {
    const xml = xmlBuilder.buildUrlSet([])
    expect(xml).toContain('<urlset')
    expect(xml).toContain('</urlset>')
    expect(xml).not.toContain('<url>')
  })

  it('includes all URL entries', () => {
    const entries = [
      '  <url><loc>https://example.com/stories/a</loc></url>',
      '  <url><loc>https://example.com/stories/b</loc></url>',
    ]
    const xml = xmlBuilder.buildUrlSet(entries)
    expect(xml).toContain('/stories/a')
    expect(xml).toContain('/stories/b')
  })

  it('byte length is computable', () => {
    const entries = ['  <url><loc>https://example.com/stories/test</loc></url>']
    const xml = xmlBuilder.buildUrlSet(entries)
    const bytes = Buffer.byteLength(xml, 'utf8')
    expect(bytes).toBeGreaterThan(0)
    expect(bytes).toBeLessThan(10 * 1024 * 1024)
  })
})

describe('xmlBuilder.safeJsonLd', () => {
  it('serializes simple object', () => {
    const obj = { '@type': 'Book', name: 'Test' }
    const result = xmlBuilder.safeJsonLd(obj)
    expect(JSON.parse(result)).toEqual(obj)
  })

  it('escapes </script> breakout', () => {
    const obj = { title: '</script><script>alert(1)</script>' }
    const result = xmlBuilder.safeJsonLd(obj)
    expect(result).not.toContain('</script>')
    expect(result).toContain('\\u003c/script\\u003e')
  })

  it('escapes < and > characters', () => {
    const obj = { title: '<b>bold</b>' }
    const result = xmlBuilder.safeJsonLd(obj)
    expect(result).not.toContain('<b>')
    expect(result).toContain('\\u003cb\\u003e')
  })

  it('escapes & character', () => {
    const obj = { url: 'https://example.com?a=1&b=2' }
    const result = xmlBuilder.safeJsonLd(obj)
    expect(result).not.toContain('&b')
    expect(result).toContain('\\u0026b')
  })

  it('handles nested objects', () => {
    const obj = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      author: { '@type': 'Person', name: 'Tác giả' },
    }
    const result = xmlBuilder.safeJsonLd(obj)
    const parsed = JSON.parse(result.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\u0027/g, "'"))
    expect(parsed.author.name).toBe('Tác giả')
  })

  it('handles Vietnamese and emoji', () => {
    const obj = { title: 'Truyện Tiên Hiệp 👑', desc: 'Hay lắm' }
    const result = xmlBuilder.safeJsonLd(obj)
    const parsed = JSON.parse(result)
    expect(parsed.title).toBe('Truyện Tiên Hiệp 👑')
  })
})
