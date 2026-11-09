import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../config/env.js', () => ({ env: { CRAWLER_SOURCES_JSON: '[]' } }))

import type { CrawlerSource } from '../crawler.config.js'
import { parseCatalog, parseChapter } from '../crawler.parser.js'

// Module-relative path keeps this test independent of cwd and the application's .env.
const source = JSON.parse(readFileSync(resolve(__dirname, '../../../../../docs/metruyenhotvn-source.json'), 'utf8')) as CrawlerSource
const storyUrl = new URL('https://metruyenhotvn.com/truyen-kiem-thu/')
const chapterTitle = 'Chương 1: Gặp lại'
const bookTitle = 'Tên truyện kiểm thử'
const oldHeading = `<div class="rv-chapt-title"><h2>${chapterTitle}</h2></div>`
const newHeading = `<h1 class="rv-chapter-heading"><span class="rv-full-story-title rv-heading-story">${bookTitle}</span><span class="rv-chapt-title rv-heading-chapter"><a href="/truyen-kiem-thu/chuong-1/">${chapterTitle}</a></span></h1>`
const body = '<div class="chapter-c"><p>Lan bước vào sân.</p><p>Gió nhẹ thổi qua.</p></div>'
const catalog = `<h1 class="title">${bookTitle}</h1><ul class="book-list list-chap"><li><a href="/truyen-kiem-thu/chuong-1/">${chapterTitle}</a></li></ul>`

describe('public metruyenhotvn profile regression', () => {
  it.each([
    ['legacy h2', oldHeading],
    ['current nested chapter heading', newHeading],
  ])('extracts the chapter rather than book title from %s', (_template, heading) => {
    const result = parseChapter(heading + body, source)

    expect(result).toEqual({ title: chapterTitle, text: 'Lan bước vào sân.\n\nGió nhẹ thổi qua.', wordCount: 8 })
    expect(result.title).not.toContain(bookTitle)
  })

  it('reproduces the previous empty-chapter failure with the legacy selector on current markup', () => {
    expect(() => parseChapter(newHeading + body, { ...source, titleSelector: '.rv-chapt-title h2' }))
      .toThrow(expect.objectContaining({ code: 'CRAWLER_EMPTY_CHAPTER' }))
  })

  it('recognizes a story catalog without treating its book title as a chapter', () => {
    expect(parseCatalog(catalog, storyUrl, source, false).chapters).toEqual([
      { title: chapterTitle, url: 'https://metruyenhotvn.com/truyen-kiem-thu/chuong-1/' },
    ])
    expect(() => parseChapter(catalog, source)).toThrow(expect.objectContaining({ code: 'CRAWLER_CATALOG_URL' }))
  })

  it('still accepts a chapter that includes links to the same story catalog', () => {
    expect(parseChapter(newHeading + body + catalog, source)).toMatchObject({ title: chapterTitle, wordCount: 8 })
  })

  it.each([
    ['chapter title', body],
    ['chapter body', newHeading],
  ])('rejects a page missing its %s', (_missing, html) => {
    expect(() => parseChapter(html, source)).toThrow(expect.objectContaining({ code: 'CRAWLER_EMPTY_CHAPTER' }))
  })

  it('does not substitute the book heading when the chapter heading is absent', () => {
    const bookHeading = `<h1 class="rv-chapter-heading"><span class="rv-heading-story">${bookTitle}</span></h1>`

    expect(() => parseChapter(bookHeading + body, source)).toThrow(expect.objectContaining({ code: 'CRAWLER_EMPTY_CHAPTER' }))
  })

  it('removes scripts and navigation while preserving paragraph and line breaks', () => {
    const html = `${newHeading}<div class="chapter-c"><p>Lan bước<br>vào sân.</p><script>unsafe()</script><nav>Chương tiếp</nav><div hidden>Nội dung ẩn</div><form>Đăng nhập</form><p>Gió nhẹ thổi qua.</p></div>`

    expect(parseChapter(html, source)).toEqual({ title: chapterTitle, text: 'Lan bước\nvào sân.\n\nGió nhẹ thổi qua.', wordCount: 8 })
  })
})
