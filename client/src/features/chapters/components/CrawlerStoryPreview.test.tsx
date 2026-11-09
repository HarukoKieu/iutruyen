import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import CrawlerStoryPreview from './CrawlerStoryPreview'

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), reset: vi.fn() }))
vi.mock('@/features/stories/hooks/useGenres', () => ({ useGenres: () => ({ data: [{ _id: 'genre-1', name: 'Ngôn Tình' }] }) }))
vi.mock('@/features/stories/hooks/useStoryMutations', () => ({ useUpdateStory: () => ({ ...mocks, isPending: false }) }))
const metadata = { title: 'Tên mới từ nguồn', description: 'Giới thiệu đủ dài để lưu.', author: 'Tác giả gốc',
  genres: ['Ngôn Tình', 'Thể loại khác'], status: 'completed' as const, rawStatus: 'Hoàn thành', truncated: false }
beforeEach(() => vi.clearAllMocks())
describe('reviewing story metadata', () => {
  it('requires confirmation and updates only selected fields without changing ownership', () => {
    render(<CrawlerStoryPreview storyId="story-1" destinationTitle="Tên hiện tại" sourceUrl="https://books.example/story" metadata={metadata} isBusy={false} />)
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Lưu thông tin truyện' })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Áp dụng tên truyện'))
    fireEvent.click(screen.getByLabelText('Áp dụng thể loại'))
    fireEvent.click(screen.getByLabelText(/Tôi có quyền/))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin truyện' }))
    expect(mocks.mutate).toHaveBeenCalledWith({ id: 'story-1', input: {
      description: 'Giới thiệu đủ dài để lưu.\n\nTác giả gốc: Tác giả gốc\nNguồn: books.example',
      status: 'completed', genreIds: ['genre-1'],
      originalAuthor: metadata.author, sourceName: 'books.example',
    } }, expect.anything())
  })
  it('does not overwrite absent description, status, genres or cover', () => {
    render(<CrawlerStoryPreview storyId="story-1" destinationTitle="Tên hiện tại" sourceUrl="https://books.example/story"
      metadata={{ ...metadata, description: '', status: undefined, genres: [] }} isBusy={false} />)
    fireEvent.click(screen.getByLabelText(/Tôi có quyền/))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin truyện' }))
    expect(mocks.mutate).toHaveBeenCalledWith({ id: 'story-1', input: { title: metadata.title, originalAuthor: metadata.author, sourceName: 'books.example' } }, expect.anything())
  })
})
