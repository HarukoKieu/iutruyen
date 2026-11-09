import { expect, it } from 'vitest'
import { storyAttribution, sourceDisplayName, descriptionWithSourceName } from './storyAttribution'

it('shows only the website name while preserving custom names and normal description links', () => {
  expect(sourceDisplayName('https://www.metruyenhotvn.com/story/chapter?x=1#text')).toBe('metruyenhotvn.com')
  expect(sourceDisplayName('Sưu tầm')).toBe('Sưu tầm')
  expect(sourceDisplayName('Mê Truyện Hot')).toBe('Mê Truyện Hot')
  expect(descriptionWithSourceName('Giới thiệu https://example.com/a\n\nNguồn: https://books.example/story')).toBe('Giới thiệu https://example.com/a\n\nNguồn: books.example')
  expect(storyAttribution({ sourceName: 'https://books.example/story' }).source).toBe('books.example')
})

const owner = { displayName: 'Người đăng' }
it('shows the original author instead of the uploader, with a source fallback', () => {
  expect(storyAttribution({ originalAuthor: 'Tác giả gốc', authorId: owner })).toEqual({ isCollected: true, author: 'Tác giả gốc', source: 'Sưu tầm' })
  expect(storyAttribution({ sourceName: 'Sưu tầm', authorId: owner }).author).toBe('Chưa rõ tác giả')
})
it('retains attribution for self-authored stories', () => {
  expect(storyAttribution({ authorId: owner })).toEqual({ isCollected: false, author: 'Người đăng', source: '' })
})
it('recognizes trailing credits from the old crawler without changing ownership', () => {
  const story = { authorId: owner, description: 'Giới thiệu\n\nTác giả gốc: A\nNguồn: https://books.example/a' }
  expect(storyAttribution(story).author).toBe('A')
  expect(story.authorId).toBe(owner)
  expect(storyAttribution({ ...story, originalAuthor: '', sourceName: '' }).isCollected).toBe(false)
  expect(storyAttribution({ ...story, description: story.description + '\nNội dung khác' }).isCollected).toBe(false)
})
