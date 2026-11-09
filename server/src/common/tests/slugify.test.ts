import { describe, it, expect } from 'vitest'
import { slugify } from '../slugify.js'

describe('slugify helper', () => {
  it('should convert Vietnamese text with accents to ascii slug', () => {
    expect(slugify('Đấu Phá Thương Khung')).toBe('dau-pha-thuong-khung')
    expect(slugify('Vạn Cổ Đệ Nhất Thần')).toBe('van-co-de-nhat-than')
    expect(slugify('Học Viện Pháp Thuật 2026!')).toBe('hoc-vien-phap-thuat-2026')
  })

  it('should handle special characters, multiple spaces and dashes', () => {
    expect(slugify('   Truyện   --  Hay  @#$%   ')).toBe('truyen-hay')
  })

  it('should return empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })
})
