import { describe, expect, it, vi } from 'vitest'
vi.mock('../../../config/env.js', () => ({ env: { CRAWLER_SOURCES_JSON: '[]' } }))
import { normalizeSourceUrl } from '../crawler.config.js'
import { parseCatalog, parseChapter, parseStoryMetadata, textToChapterHtml } from '../crawler.parser.js'
import { assertRobotsAllowed } from '../crawler.robots.js'

const source = { hostname: 'books.example.org', titleSelector: 'h1', contentSelector: '.chapter', chapterLinkSelector: '.toc a', removeSelector: '.advert' }
const url = new URL('https://books.example.org/story/')

describe('story metadata extraction', () => {
  const profile = { ...source, storySelectors: { title: '.story-title', description: '.intro',
    author: '.author', genres: '.genre', status: '.status', cover: 'img.cover' }, imageHosts: ['images.example.org'] }
  it('extracts plain metadata and retains paragraphs without executable markup', () => {
    const story = parseStoryMetadata('<h1 class="story-title">Tên truyện</h1><div class="intro"><p>Đoạn một.</p><p>Đoạn hai.</p><script>bad()</script></div><span class="author">Tác giả: A</span><b class="genre">Fantasy</b><b class="genre">Fantasy</b><span class="status">Hoàn thành</span><img class="cover" data-src="https://images.example.org/cover.jpg">', url, profile)
    expect(story).toMatchObject({ title: 'Tên truyện', description: 'Đoạn một.\n\nĐoạn hai.', author: 'A', genres: ['Fantasy'], status: 'completed', coverUrl: 'https://images.example.org/cover.jpg', truncated: false })
    expect(story).not.toHaveProperty('authorId')
  })
  it.each(['https://evil.example.org/x', 'http://images.example.org/x', 'https://user:pass@images.example.org/x', 'https://127.0.0.1/x'])('omits unapproved cover URL %s', cover => {
    expect(parseStoryMetadata(`<h1 class="story-title">Title</h1><img class="cover" src="${cover}">`, url, profile)?.coverUrl).toBeUndefined()
  })
  it('does not invent missing fields or a status and can preview without chapter links', () => {
    const result = parseCatalog('<h1 class="story-title">Story</h1><b class="status">Không xác định</b>', url, profile)
    expect(result.chapters).toEqual([])
    expect(result.story).toMatchObject({ description: '', author: '', genres: [] })
    expect(result.story?.status).toBeUndefined()
    expect(parseStoryMetadata('<h1>Chapter title</h1>', url, profile)).toBeUndefined()
  })
  it('flags truncation and supports multiple description paragraphs', () => {
    const result = parseStoryMetadata(`<h1 class="story-title">Story</h1><p class="intro">One</p><p class="intro">Two</p>`, url, profile)
    expect(result?.description).toBe('One\n\nTwo')
    expect(parseStoryMetadata(`<h1 class="story-title">Story</h1><p class="intro">${'a'.repeat(5001)}</p>`, url, profile)).toMatchObject({ truncated: true, description: 'a'.repeat(5000) })
  })
})
describe('crawler extraction and source boundaries', () => {
  it('resolves relative links, strips fragments and deduplicates only in-source links', () => {
    const result = parseCatalog('<title>Truyện</title><div class="toc"><a href="chapter-1#read">Một</a><a href="chapter-1">Lặp</a><a href="https://elsewhere.org/x">Ngoài</a><a href="http://books.example.org/x">HTTP</a></div>', url, source)
    expect(result.chapters).toEqual([{ title: 'Một', url: 'https://books.example.org/story/chapter-1' }])
  })
  it('extracts paragraphs and excludes scripts, ads, navigation and forms', () => {
    const result = parseChapter('<h1>Chương 1</h1><div class="chapter"><p>Xin chào<br>bạn.</p><div>Đoạn hai.</div><script>bad()</script><div class="advert">Quảng cáo</div><nav>Tiếp</nav></div>', source)
    expect(result.text).toBe('Xin chào\nbạn.\n\nĐoạn hai.')
    expect(result.wordCount).toBe(5)
  })
  it('escapes text before persisting HTML', () => {
    expect(textToChapterHtml('<img onerror="x"> & test')).toContain('&lt;img onerror=&quot;x&quot;&gt; &amp; test')
    expect(textToChapterHtml('<script>x</script>')).not.toContain('<script>')
  })
  it('reports empty selectors and oversized chapters', () => {
    expect(() => parseChapter('<h1>T</h1>', source)).toThrow(/Không trích/)
    expect(() => parseChapter(`<h1>T</h1><div class="chapter">${'a'.repeat(100001)}</div>`, source)).toThrow(/100.000/)
  })
  it('explains how to preview when a catalog URL was submitted as a chapter', () => {
    expect(() => parseChapter('<div class="toc"><a href="/chapter-1">Chương 1</a></div>', source))
      .toThrow(/Lấy mục lục/)
  })
  it('still parses a chapter that also contains catalog links', () => {
    const result = parseChapter('<h1>Chương 1</h1><div class="chapter">Nội dung.</div><div class="toc"><a href="/chapter-2">Chương 2</a></div>', source)
    expect(result.text).toBe('Nội dung.')
  })
  it.each(['http://books.example.org/a', 'https://localhost/a', 'https://127.0.0.1/a', 'https://books.example.org:8443/a', 'https://user:pass@books.example.org/a', 'https://books.example.org.evil.org/a'])('rejects unsafe URL %s', value => {
    expect(() => normalizeSourceUrl(value, source.hostname)).toThrow()
  })
  it('caps extracted catalogs with an explicit truncation flag', () => {
    const result = parseCatalog(`<div class="toc">${Array.from({ length: 2002 }, (_, n) => `<a href="/${n}">${n}</a>`).join('')}</div>`, url, source)
    expect(result.chapters).toHaveLength(2000)
    expect(result.truncated).toBe(true)
  })
})

describe('crawler robots restrictions', () => {
  it('honors disallow, longest allow and wildcard/end anchor rules', () => {
    const robots = 'User-agent: *\nDisallow: /private\nAllow: /private/open\nDisallow: /*?download=1$'
    expect(() => assertRobotsAllowed(robots, new URL('/private/x', url))).toThrow()
    expect(() => assertRobotsAllowed(robots, new URL('/private/open', url))).not.toThrow()
    expect(() => assertRobotsAllowed(robots, new URL('/a?download=1', url))).toThrow()
    expect(() => assertRobotsAllowed(robots, new URL('/a?download=12', url))).not.toThrow()
  })
  it('does not bypass encoded paths or bot-specific exclusions', () => {
    expect(() => assertRobotsAllowed('User-agent: IutruyenCrawler\nDisallow: /private', new URL('/%70rivate', url))).toThrow()
    expect(() => assertRobotsAllowed('User-agent: *\nCrawl-delay: 10', url)).toThrow()
    expect(() => assertRobotsAllowed('<html>Blocked</html>', url)).toThrow()
  })
})
