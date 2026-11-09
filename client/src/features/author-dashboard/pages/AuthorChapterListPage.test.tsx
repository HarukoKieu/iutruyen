import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { ChapterListItem } from '@/types/chapter'
import AuthorChapterListPage from './AuthorChapterListPage'

const state = vi.hoisted(() => ({ chapters: [] as ChapterListItem[], isError: false, refetch: vi.fn() }))
vi.mock('@/components/layout/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/features/stories/hooks/useStory', () => ({ useStoryById: () => ({ data: { _id: 'story', title: 'Truyện', slug: 'truyen' } }) }))
vi.mock('@/features/chapters/hooks/useChapters', () => ({ useChapters: () => ({ data: state.chapters, isError: state.isError, refetch: state.refetch }) }))
vi.mock('@/features/chapters/hooks/useChapterMutations', () => ({ useDeleteChapter: () => ({ mutate: vi.fn() }) }))
vi.mock('@/components/ui/alert-dialog', () => ({ AlertDialog: () => null }))

beforeEach(() => {
  state.isError = false
  state.refetch.mockClear()
  state.chapters = [{ _id: 'chapter', storyId: 'story', title: 'Mở đầu', slug: 'mo-dau', order: 1,
    status: 'published', moderationStatus: 'pending', viewCount: 0, createdAt: '2026-10-12' }]
})
function renderList() { render(<MemoryRouter><AuthorChapterListPage /></MemoryRouter>) }

describe('author chapter publication status', () => {
  it('reports a failed chapter request with retry rather than an empty chapter list', () => {
    state.isError = true
    state.chapters = []
    renderList()
    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được danh sách chương')
    expect(screen.queryByText('Chưa có chương nào')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(state.refetch).toHaveBeenCalledTimes(1)
  })
  it.each(['published', 'scheduled'] as const)('shows %s chapters as pending until approved', status => {
    state.chapters[0].status = status
    renderList()
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
    expect(screen.queryByText('Đã xuất bản')).not.toBeInTheDocument()
  })
  it('shows publication only after approval', () => {
    state.chapters[0].moderationStatus = 'approved'
    renderList()
    expect(screen.getByText('Đã xuất bản')).toBeInTheDocument()
    expect(screen.queryByText('Chờ duyệt')).not.toBeInTheDocument()
  })
  it('does not claim publication when moderation state is missing or hidden', () => {
    state.chapters.push({ ...state.chapters[0], _id: 'hidden', moderationStatus: 'hidden' })
    state.chapters[0].moderationStatus = undefined
    renderList()
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
    expect(screen.getByText('Bị ẩn')).toBeInTheDocument()
    expect(screen.queryByText('Đã xuất bản')).not.toBeInTheDocument()
  })
  it('keeps drafts unpublished even when a moderator has approved the content', () => {
    state.chapters[0].status = 'draft'
    state.chapters[0].moderationStatus = 'approved'
    renderList()
    expect(screen.getByText('Bản thảo')).toBeInTheDocument()
    expect(screen.queryByText('Đã xuất bản')).not.toBeInTheDocument()
  })
})
