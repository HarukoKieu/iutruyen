import { describe, it, expect } from 'vitest'
import { decodeCover } from '../seo.cover.js'
import { seoOrigin } from '../../../common/seoOrigin.js'
import { seoAuthor } from '../seo.attribution.js'
describe('SEO trust boundaries', () => {
  it('does not substitute the uploader for an unknown collected author', () => {
    expect(seoAuthor({ description: '', sourceName: 'Nguồn sưu tầm', author: { displayName: 'Người đăng' } })).toBeUndefined()
    expect(seoAuthor({ description: '', originalAuthor: 'Tác giả gốc', author: null })).toBe('Tác giả gốc')
    expect(seoAuthor({ description: 'Giới thiệu\n\nTác giả gốc: Người viết\nNguồn: https://example.test', author: { displayName: 'Người đăng' } })).toBe('Người viết')
  })
  it.each(['javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com/?q=1', 'http://example.com'])('rejects unsafe origin %s', value => {
    expect(() => seoOrigin(value)).toThrow()
  })
  it('permits localhost only for local development', () => {
    expect(seoOrigin('http://localhost:5173')).toBe('http://localhost:5173')
    expect(() => seoOrigin('http://localhost:5173', true)).toThrow()
  })
  it('rejects fake MIME, SVG and malformed base64', () => {
    for (const value of ['data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64'), 'data:image/svg+xml;base64,AAAA', 'data:image/jpeg;base64,%%%=', 'data:image/png;base64,A===']) expect(decodeCover(value)).toBeNull()
  })
  it('accepts a PNG signature and keeps the matching MIME', () => {
    const bytes = Buffer.alloc(24)
    Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes)
    bytes.write('IHDR', 12)
    expect(decodeCover('data:image/png;base64,' + bytes.toString('base64'))?.mime).toBe('image/png')
  })
})
