import { describe, expect, it } from 'vitest'
import { parseCrawlerJobPage } from '../crawler-job.parser.js'

const source = { hostname: 'books.example.org', titleSelector: 'h1', contentSelector: 'article', chapterLinkSelector: '.toc a', nextCatalogSelector: '.next' }
const url = new URL('https://books.example.org/story')
const chapters = '<div class="toc"><a href="/c1">Chương 1</a><a href="/c1#x">Lặp</a><a href="https://other.example/c2">Ngoài nguồn</a></div>'
describe('explicit catalog pagination', () => {
  it('normalizes and deduplicates chapter URLs and follows safe relative next link', () => {
    const result = parseCrawlerJobPage(`${chapters}<a class="next" href="?page=2">Tiếp</a>`, url, source)
    expect(result.chapters).toEqual([{ title: 'Chương 1', url: 'https://books.example.org/c1' }])
    expect(result.nextUrl).toBe('https://books.example.org/story?page=2')
  })
  it.each(['http://books.example.org/2', 'https://other.example/2', 'https://books.example.org:444/2', 'javascript:void(0)'])('rejects unsafe next URL %s', href => {
    expect(() => parseCrawlerJobPage(`${chapters}<a class="next" href="${href}">Tiếp</a>`, url, source)).toThrow(expect.objectContaining({ code: 'CRAWLER_PAGINATION_URL' }))
  })
  it('reports incomplete source configuration instead of guessing navigation', () => {
    const { nextCatalogSelector: _, ...singlePage } = source
    expect(parseCrawlerJobPage(chapters, url, singlePage)).toMatchObject({ nextUrl: undefined, warning: expect.stringContaining('chỉ lấy chương') })
  })
  it('reports the bounded prefix so the planner can stop at an explicitly selected range', () => {
    const html = `<div class="toc">${Array.from({ length: 2001 }, (_, i) => `<a href="/${i}">Chương ${i}</a>`).join('')}</div>`
    const result = parseCrawlerJobPage(html, url, source)
    expect(result.truncated).toBe(true); expect(result.chapters).toHaveLength(2000)
  })
})
