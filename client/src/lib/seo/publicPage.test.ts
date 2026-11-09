import { describe, it, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { loadPublicPage, seedPage, safeJson, fallbackMeta, seoPath, type PublicPage } from './publicPage'

describe('public render boundary', () => {
  it('accepts generated chapter slugs without relaxing story/path validation', () => {
    const path = '/stories/a/chapters/chuong-1-' + 'a'.repeat(200)
    expect(seoPath(path)).toBe(path)
    expect(seoPath('/stories/' + 'a'.repeat(201))).toBeNull()
    expect(seoPath('/stories/a/chapters/' + 'a'.repeat(513))).toBeNull()
    expect(seoPath('/stories/a/chapters/abc_def')).toBeNull()
  })
  it('seeds genre identities and the actual list DTO rather than a full chapter', () => {
    const client = new QueryClient()
    const item = { _id: 'chapter', storyId: 'story', slug: 'chapter', title: 'Chapter', order: 1, status: 'published' as const, viewCount: 2, createdAt: '2026-01-01T00:00:00.000Z' }
    seedPage(client, { status: 200, meta: fallbackMeta(), story: { _id: 'story', slug: 'a', title: 'A', description: '', contentWarning: 'none', author: null, genres: [{ _id: 'genre', name: 'Genre', slug: 'genre' }], tags: [] }, toc: { items: [item], hasMore: false, nextCursor: null } }, '/stories/a')
    expect(client.getQueryData(['story', 'a'])).toMatchObject({ genreIds: [{ _id: 'genre' }] })
    expect(client.getQueryData(['chapters', 'story', 'public', {}])).toMatchObject({ pages: [{ items: [item] }] })
    client.clear()
  })
  it('serializes script terminators without changing JSON content', () => {
    const value = { title: '</script><script>alert(1)</script><!--\u2028' }
    const json = safeJson(value)
    expect(json).not.toContain('<')
    expect(JSON.parse(json)).toEqual(value)
  })
  it.each([404, 429, 500, 503])('maps HTTP %s without inventing successful content', async status => {
    const page = await loadPublicPage(new URL('https://example.test/stories/test'), async () => new Response(null, { status }))
    expect(page.status).toBe(status === 500 ? 503 : status)
    expect(page.meta.indexable).toBe(false)
  })
  it('does not send unknown paths to an upstream origin', async () => {
    const fetcher = vi.fn()
    expect((await loadPublicPage(new URL('https://example.test/unknown'), fetcher)).status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('marks query variants noindex and removes their canonical', async () => {
    const page = await loadPublicPage(new URL('https://example.test/stories?sort=hot'), async () => Response.json({ success: true, data: { meta: { ...fallbackMeta(), indexable: true } } }))
    expect(page.meta.indexable).toBe(false)
    expect(page.meta.canonical).toBe('')
  })
  it('keeps request caches isolated and does not hydrate mature content', () => {
    const first = new QueryClient(), second = new QueryClient()
    const page: PublicPage = { status: 200, meta: fallbackMeta(), story: { _id: 'id', slug: 'a', title: 'A', description: 'A', contentWarning: 'none', author: null, genres: [], tags: [] } }
    seedPage(first, page, '/stories/a')
    expect(first.getQueryData(['story', 'a'])).toBeTruthy()
    expect(second.getQueryData(['story', 'a'])).toBeUndefined()
    seedPage(second, { ...page, story: { ...page.story!, contentWarning: 'mature18+' } }, '/stories/a')
    expect(second.getQueryCache().getAll()).toHaveLength(0)
    first.clear(); second.clear()
  })
})
