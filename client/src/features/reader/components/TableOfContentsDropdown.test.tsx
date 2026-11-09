import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TableOfContentsDropdown } from './TableOfContentsDropdown'
import type { ChapterListItem } from '@/types/chapter'

const chapters: ChapterListItem[] = [
  { _id: 'c1', storyId: 's1', order: 1, slug: 'crawl-1', title: 'Chương 1: Khởi đầu', status: 'published', viewCount: 0, createdAt: '' },
  { _id: 'c2', storyId: 's1', order: 2, slug: 'crawl-2', title: 'Hành trình', status: 'published', viewCount: 0, createdAt: '' },
]

function setup(overrides = {}) {
  const props = { chapters, currentChapterId: 'c1', storySlug: 'truyen-mau', onLoadMore: vi.fn(), onRetry: vi.fn(), ...overrides }
  render(<MemoryRouter><TableOfContentsDropdown {...props} /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Mục lục' }))
  return props
}

describe('Table of contents dropdown', () => {
  it('marks the current chapter, uses readable URLs, and closes when selecting', () => {
    setup()
    const current = screen.getByRole('link', { name: 'Chương 1: Khởi đầu' })
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(current).toHaveAttribute('href', '/stories/truyen-mau/chapters/chuong-1')
    fireEvent.click(screen.getByRole('link', { name: 'Chương 2: Hành trình' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('filters by title or chapter number and keeps pagination available', () => {
    const props = setup({ hasMore: true })
    const search = screen.getByRole('searchbox')
    fireEvent.change(search, { target: { value: '2' } })
    expect(screen.queryByRole('link', { name: 'Chương 1: Khởi đầu' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Chương 2: Hành trình' })).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'khởi đầu' } })
    expect(screen.getByRole('link', { name: 'Chương 1: Khởi đầu' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tải thêm chương' }))
    expect(props.onLoadMore).toHaveBeenCalledOnce()
  })

  it('closes on Escape and outside clicks', () => {
    setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Mục lục' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Mục lục' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('allows retrying a failed chapter request', () => {
    const props = setup({ chapters: [], error: true })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(props.onRetry).toHaveBeenCalledOnce()
  })
})
