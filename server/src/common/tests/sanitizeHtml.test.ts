import { describe, it, expect } from 'vitest'
import { sanitizeHtml, countWordsFromHtml } from '../sanitizeHtml.js'

describe('sanitizeHtml', () => {
  it('should preserve safe formatting tags', () => {
    const input = '<p>Xin chào <strong>thế giới</strong>!</p><blockquote>Đoạn trích dẫn</blockquote>'
    const result = sanitizeHtml(input)
    expect(result).toBe(input)
  })

  it('should completely strip script tags and their content', () => {
    const input = '<p>Bắt đầu</p><script>alert("XSS")</script><p>Kết thúc</p>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert')
    expect(result).toBe('<p>Bắt đầu</p><p>Kết thúc</p>')
  })

  it('should remove inline event handlers', () => {
    const input = '<p onclick="alert(1)">Nội dung</p><span onmouseover="evil()">Click me</span>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('onclick')
    expect(result).not.toContain('onmouseover')
    expect(result).toContain('<p>Nội dung</p>')
    expect(result).toContain('<span>Click me</span>')
  })

  it('should remove dangerous protocols in links or sources', () => {
    const input = '<a href="javascript:alert(1)">Link độc</a>'
    const result = sanitizeHtml(input)
    // <a> is not in ALLOWED_TAGS so tag itself is stripped, keeping inner text
    expect(result).not.toContain('javascript:')
    expect(result).toBe('Link độc')
  })

  it('should strip iframe and embed tags', () => {
    const input = '<p>Truyện hay</p><iframe src="http://evil.com"></iframe>'
    const result = sanitizeHtml(input)
    expect(result).toBe('<p>Truyện hay</p>')
  })
})

describe('countWordsFromHtml', () => {
  it('should correctly count words in HTML', () => {
    const input = '<p>Một hai ba bốn năm.</p>'
    expect(countWordsFromHtml(input)).toBe(5)
  })

  it('should handle empty or whitespace HTML', () => {
    expect(countWordsFromHtml('')).toBe(0)
    expect(countWordsFromHtml('<p></p>')).toBe(0)
    expect(countWordsFromHtml('   ')).toBe(0)
  })
})
