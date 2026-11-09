import type { QueryClient } from '@tanstack/react-query'
import type { SeoHeadOptions } from '@/hooks/useSeoHead'
import type { ChapterListItem } from '@/types/chapter'

export interface RenderStory {
  _id: string; slug: string; title: string; description: string; contentWarning: string
  author: { username: string; displayName: string } | null
  genres: Array<{ _id: string; name: string; slug: string }>; tags: Array<{ _id: string; name: string; slug: string }>
  [key: string]: unknown
}
export interface PageMeta extends SeoHeadOptions {
  title: string; description: string; canonical: string; indexable: boolean
  og: { image: string; type: 'website' | 'book' | 'article' }
}
export interface PublicPage {
  status: number
  meta: PageMeta
  story?: RenderStory
  chapter?: { _id: string; slug: string; contentHtml: string; [key: string]: unknown }
  prev?: unknown; next?: unknown
  toc?: { items: ChapterListItem[]; hasMore: boolean; nextCursor: string | null }
  groups?: Array<{ query: { sort: string; limit: number }; stories: RenderStory[]; meta: unknown }>
  now?: number
}
export const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
export const fallbackMeta = (): PageMeta => ({ title: 'iutruyen — Đọc truyện chữ', description: 'Thư viện truyện chữ iutruyen.', canonical: '', indexable: false, og: { image: '/og-default.png', type: 'website' }, jsonLd: null })
export function seoPath(path: string): string | null {
  if (path === '/') return '/catalog/home'
  if (path === '/stories') return '/catalog/stories'
  if (path === '/ranking') return '/catalog/ranking'
  if (/^\/stories\/[a-z0-9-]{1,200}(\/chapters\/[a-z0-9-]{1,512})?$/.test(path)) return path
  return null
}
export function seedPage(client: QueryClient, page: PublicPage, pathname: string) {
  if (page.status !== 200) return
  const map = (story: RenderStory) => ({ ...story, authorId: story.author, genreIds: story.genres, tagIds: story.tags })
  if (page.story && page.story.contentWarning !== 'mature18+') {
    const story = map(page.story)
    client.setQueryData(['story', story.slug], story)
    if (page.chapter) client.setQueryData(['chapter', story.slug, page.chapter.slug, 'public'], { story, chapter: page.chapter, prevChapter: page.prev, nextChapter: page.next })
    if (page.toc) {
      const data = { pages: [{ items: page.toc.items, meta: { hasMore: page.toc.hasMore, nextCursor: page.toc.nextCursor, limit: 50 } }], pageParams: [null] }
      for (const options of [{}, { sort: 'asc' }, { sort: 'asc', q: '' }]) client.setQueryData(['chapters', story._id, 'public', options], data)
    }
  }
  for (const group of page.groups ?? []) {
    let key: unknown[] = ['stories', group.query]
    if (pathname === '/stories') key = ['stories', { sort: 'new', limit: 24 }]
    // Ranking's cursor has a different contract. Its own API will fetch after mount.
    if (pathname === '/ranking') key = ['ranking', { metric: 'views', period: 'all', limit: 20 }]
    client.setQueryData(key, { pages: [{ stories: group.stories.map(map), meta: group.meta }], pageParams: [null] })
  }
}
export async function loadPublicPage(url: URL, fetcher: (path: string) => Promise<Response>): Promise<PublicPage> {
  const path = seoPath(url.pathname)
  if (!path) return { status: 404, meta: { ...fallbackMeta(), title: 'Không tìm thấy trang — iutruyen' } }
  try {
    const response = await fetcher(path)
    if (!response.ok) return { status: response.status === 404 ? 404 : response.status === 429 ? 429 : 503, meta: fallbackMeta() }
    const body = await response.json()
    if (!body.success || !body.data?.meta) throw new Error('Invalid public projection')
    const page: PublicPage = { ...body.data, status: 200, now: Date.now() }
    if (url.search) page.meta = { ...page.meta, indexable: false, canonical: '', jsonLd: null }
    return page
  } catch { return { status: 503, meta: fallbackMeta() } }
}
