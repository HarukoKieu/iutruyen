/**
 * SEO Validation Tests — Phase 8
 * Kiểm tra tất cả Zod schemas từ seo.validation.ts
 */
import { describe, it, expect } from 'vitest'
import { createChapterSchema, updateChapterSchema } from '../../chapters/chapters.validation.js'
import {
  storySlugParamSchema,
  chapterSlugParamSchema,
  tocQuerySchema,
  coverParamSchema,
  sitemapShardParamSchema,
  catalogKindParamSchema,
} from '../seo.validation.js'

describe('storySlugParamSchema', () => {
  it('accepts valid slug', () => {
    expect(() => storySlugParamSchema.parse({ slug: 'tieu-thuyet-123' })).not.toThrow()
  })

  it('rejects empty slug', () => {
    expect(() => storySlugParamSchema.parse({ slug: '' })).toThrow()
  })

  it('rejects slug with uppercase', () => {
    expect(() => storySlugParamSchema.parse({ slug: 'TieuThuyet' })).toThrow()
  })

  it('rejects slug with special chars', () => {
    expect(() => storySlugParamSchema.parse({ slug: 'tieu_thuyet!' })).toThrow()
  })

  it('rejects slug over 200 chars', () => {
    expect(() => storySlugParamSchema.parse({ slug: 'a'.repeat(201) })).toThrow()
  })
})

describe('chapterSlugParamSchema', () => {
  it('accepts generated long chapter slugs and bounds the request target', () => {
    expect(chapterSlugParamSchema.safeParse({ slug: 'story', chapterSlug: 'chuong-1-' + 'a'.repeat(200) }).success).toBe(true)
    expect(chapterSlugParamSchema.safeParse({ slug: 'story', chapterSlug: 'a'.repeat(512) }).success).toBe(true)
    expect(chapterSlugParamSchema.safeParse({ slug: 'story', chapterSlug: 'a'.repeat(513) }).success).toBe(false)
  })
  it('rejects unsafe chapter orders that would generate exponent notation or lose precision', () => {
    const input = { title: 'a'.repeat(200), contentHtml: '<p>Chapter content.</p>' }
    expect(createChapterSchema.safeParse({ ...input, order: Number.MAX_SAFE_INTEGER }).success).toBe(true)
    for (const order of [Number.MAX_SAFE_INTEGER + 1, 1e30]) {
      expect(createChapterSchema.safeParse({ ...input, order }).success).toBe(false)
      expect(updateChapterSchema.safeParse({ order }).success).toBe(false)
    }
  })
  it('accepts valid story slug and chapter slug', () => {
    expect(() =>
      chapterSlugParamSchema.parse({ slug: 'tieu-thuyet', chapterSlug: 'chuong-1' })
    ).not.toThrow()
  })

  it('rejects missing chapterSlug', () => {
    expect(() => chapterSlugParamSchema.parse({ slug: 'tieu-thuyet' })).toThrow()
  })

  it('rejects invalid chapterSlug', () => {
    expect(() =>
      chapterSlugParamSchema.parse({ slug: 'tieu-thuyet', chapterSlug: 'Chương 1!' })
    ).toThrow()
  })
})

describe('tocQuerySchema', () => {
  it('uses defaults when params empty', () => {
    const result = tocQuerySchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.cursor).toBeUndefined()
  })

  it('accepts valid cursor and limit', () => {
    const result = tocQuerySchema.parse({ cursor: 'abc', limit: '20' })
    expect(result.limit).toBe(20)
    expect(result.cursor).toBe('abc')
  })

  it('rejects limit over 100', () => {
    expect(() => tocQuerySchema.parse({ limit: '200' })).toThrow()
  })

  it('rejects limit 0', () => {
    expect(() => tocQuerySchema.parse({ limit: '0' })).toThrow()
  })
})

describe('coverParamSchema', () => {
  it('accepts valid 24-char ObjectId', () => {
    expect(() =>
      coverParamSchema.parse({ storyId: '507f1f77bcf86cd799439011' })
    ).not.toThrow()
  })

  it('rejects non-ObjectId string', () => {
    expect(() => coverParamSchema.parse({ storyId: 'invalid-id' })).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => coverParamSchema.parse({ storyId: '' })).toThrow()
  })
})

describe('sitemapShardParamSchema', () => {
  it('accepts valid generation, kind=stories, shard=0', () => {
    const result = sitemapShardParamSchema.parse({
      generation: 'abcdef0123456789',
      kind: 'stories',
      shard: '0',
    })
    expect(result.shard).toBe(0)
  })

  it('accepts kind=chapters', () => {
    expect(() =>
      sitemapShardParamSchema.parse({
        generation: 'abcdef0123456789',
        kind: 'chapters',
        shard: '5',
      })
    ).not.toThrow()
  })

  it('rejects invalid generation format', () => {
    expect(() =>
      sitemapShardParamSchema.parse({
        generation: 'INVALID_GEN!!',
        kind: 'stories',
        shard: '0',
      })
    ).toThrow()
  })

  it('rejects unknown kind', () => {
    expect(() =>
      sitemapShardParamSchema.parse({
        generation: 'abcdef0123456789',
        kind: 'tags',
        shard: '0',
      })
    ).toThrow()
  })

  it('rejects negative shard', () => {
    expect(() =>
      sitemapShardParamSchema.parse({
        generation: 'abcdef0123456789',
        kind: 'stories',
        shard: '-1',
      })
    ).toThrow()
  })
})

describe('catalogKindParamSchema', () => {
  it.each(['home', 'stories', 'ranking'])('accepts kind=%s', (kind) => {
    expect(() => catalogKindParamSchema.parse({ kind })).not.toThrow()
  })

  it('rejects unknown kind', () => {
    expect(() => catalogKindParamSchema.parse({ kind: 'admin' })).toThrow()
  })
})
