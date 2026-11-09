import { describe, expect, it } from 'vitest'
import { chapterSlugFilter } from './chapterUrl.js'

describe('Chapter URL lookup', () => {
  it('resolves short chapter URLs by order', () => {
    expect(chapterSlugFilter('chuong-1')).toEqual({ order: 1 })
    expect(chapterSlugFilter('chuong-20')).toEqual({ order: 20 })
  })
  it('preserves old crawler and title links', () => {
    expect(chapterSlugFilter('crawl-abc123')).toEqual({ slug: 'crawl-abc123' })
    expect(chapterSlugFilter('chuong-1-mo-dau')).toEqual({ slug: 'chuong-1-mo-dau' })
    expect(chapterSlugFilter('chuong-999999999999999999')).toEqual({ slug: 'chuong-999999999999999999' })
  })
})
