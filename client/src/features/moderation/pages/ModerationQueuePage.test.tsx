import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import ModerationQueuePage from './ModerationQueuePage'

vi.mock('../hooks/useModeration', () => {
  const mutation = () => ({ isPending: false, mutate: vi.fn() })
  return {
    useModerateStory: mutation, useModerateChapter: mutation, useModerateComment: mutation,
    useChapterQueue: () => ({ data: { pages: [{ chapters: [{ _id: 'chapter-1', title: 'Chương chờ duyệt', order: 1, storyId: { title: 'Truyện mẫu' }, createdAt: new Date().toISOString(), contentHtml: '<p>Nội dung cần xem trước</p>' }] }] } }),
    useCommentQueue: () => ({ data: { pages: [{ comments: [{ _id: 'comment-1', content: 'Bình luận dài '.repeat(30), createdAt: new Date().toISOString() }] }] } }),
    useStoryQueue: () => ({ data: { pages: [{ stories: [] }] } }),
  }
})

describe('Moderation previews', () => {
  it('opens full chapter content in an isolated preview and can collapse it', () => {
    render(<MemoryRouter><ModerationQueuePage defaultType="chapters" /></MemoryRouter>)
    expect(screen.queryByTitle('Nội dung Chương chờ duyệt')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem nội dung' }))
    const frame = screen.getByTitle('Nội dung Chương chờ duyệt')
    expect(frame).toHaveAttribute('sandbox', '')
    expect(frame.getAttribute('srcdoc')).toContain('<p>Nội dung cần xem trước</p>')
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn' }))
    expect(screen.queryByTitle('Nội dung Chương chờ duyệt')).toBeNull()
  })

  it('shows the entire comment instead of its truncated excerpt', () => {
    render(<MemoryRouter><ModerationQueuePage defaultType="comments" /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Xem nội dung' }))
    expect(screen.getByText('Bình luận dài '.repeat(30).trim())).toBeInTheDocument()
  })
})
