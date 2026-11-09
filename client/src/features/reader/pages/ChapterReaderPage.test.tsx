import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { submitUserReport } from '@/features/moderation/api/moderation.api'
import type { ChapterDetailResponse } from '@/types/chapter'
import ChapterReaderPage from './ChapterReaderPage'

const state = vi.hoisted(() => ({ data: null as ChapterDetailResponse | null, history: vi.fn(), tocQuery: vi.fn(), isAuthenticated: true }))
vi.mock('@/features/auth/store/authStore', () => ({ useAuthStore: (selector: (value: { isAuthenticated: boolean }) => unknown) => selector(state) }))
vi.mock('@/features/moderation/api/moderation.api')
vi.mock('@/features/chapters/hooks/useChapterDetail', () => ({ useChapterDetail: () => ({ data: state.data }) }))
vi.mock('@/features/chapters/hooks/useChapters', () => ({ useChapters: (_id: string, options: { q?: string }) => {
  state.tocQuery(options.q)
  return { data: (options.q === '999' ? [999] : [1, 2, 3]).map(order => ({ _id: `chapter-${order}`, order, title: `Chương ${order}`, slug: `chuong-${order}` })) }
} }))
vi.mock('@/features/follows-bookmarks/hooks/useReadingHistory', () => ({ useUpsertReadingHistory: () => ({ mutate: state.history }) }))
vi.mock('@/features/reader-settings/store/readerSettingsStore', () => ({ useReaderSettingsStore: () => ({ fontFamily: 'serif', fontSize: 18, lineHeight: 1.8, containerWidth: 'normal', textAlign: 'left' }) }))
vi.mock('@/features/stories/hooks/useMatureConfirmation', () => ({ useMatureConfirmation: () => ({ isConfirmed: true, confirm: vi.fn() }) }))
vi.mock('../components/ReaderToolbar', () => ({ ReaderToolbar: ({ onOpenReport }: { onOpenReport: () => void }) => <button onClick={onOpenReport}>Báo cáo từ thanh công cụ</button> }))
vi.mock('../components/ReaderSettingsModal', () => ({ ReaderSettingsModal: () => null }))
vi.mock('../components/ChapterCommentsDrawer', () => ({ ChapterCommentsDrawer: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div role="dialog" aria-label="Bình luận chương" /> : null }))
vi.mock('@/features/stories/components/Mature18WarningModal', () => ({ Mature18WarningModal: () => null }))
vi.mock('@/components/common/AdSlot', () => ({ default: () => null }))

beforeEach(() => {
  vi.clearAllMocks()
  state.isAuthenticated = true
  state.data = {
    chapter: { _id: 'chapter-2', storyId: 'story', title: 'Chương 2', slug: 'chuong-2', order: 2,
      contentHtml: '<p>Nội dung chương thứ hai.</p>', status: 'published', moderationStatus: 'approved', viewCount: 10,
      createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z' },
    story: { _id: 'story', title: 'Truyện mẫu', slug: 'truyen-mau', authorId: 'author', chapterCount: 3,
      contentWarning: 'none', moderationStatus: 'approved' },
    prevChapter: { _id: 'chapter-1', order: 1, title: 'Chương 1', slug: 'chuong-1' },
    nextChapter: { _id: 'chapter-3', order: 3, title: 'Chương 3', slug: 'chuong-3' },
  }
})

function renderReader() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/stories/truyen-mau/chapters/chuong-2']}>
    <Routes>
      <Route path="/stories/:slug/chapters/:chapterSlug" element={<ChapterReaderPage />} />
      <Route path="/login" element={<LoginDestination />} />
    </Routes>
  </MemoryRouter></QueryClientProvider>)
}

function LoginDestination() {
  const location = useLocation()
  return <p>Đăng nhập để quay lại: {location.state?.from?.pathname}</p>
}

describe('chapter controls at both ends of the chapter', () => {
  it.each(['Báo cáo vấn đề', 'Báo cáo từ thanh công cụ'])('submits an issue for the current chapter from %s', async label => {
    vi.mocked(submitUserReport).mockResolvedValue({ _id: 'report-new' } as Awaited<ReturnType<typeof submitUserReport>>)
    renderReader()
    fireEvent.click(screen.getByRole('button', { name: label }))
    const dialog = screen.getByRole('dialog', { name: 'Báo cáo vấn đề' })
    expect(within(dialog).getByText('Truyện mẫu — Chương 2')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thiếu nội dung chương' }))
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '  Thiếu đoạn cuối  ' } })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Chương 2')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi báo cáo' }))
    await waitFor(() => expect(submitUserReport).toHaveBeenCalledWith({
      targetType: 'chapter', targetId: 'chapter-2', reason: 'missing_content', description: 'Thiếu đoạn cuối',
    }))
    expect(await screen.findByRole('status')).toHaveTextContent('Báo cáo đã được ghi nhận!')
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog', { name: 'Báo cáo vấn đề' })).not.toBeInTheDocument()
  })

  it('asks guests to sign in and preserves the chapter return path', () => {
    state.isAuthenticated = false
    renderReader()
    fireEvent.click(screen.getByRole('button', { name: 'Báo cáo vấn đề' }))
    expect(screen.getByText('Đăng nhập để quay lại: /stories/truyen-mau/chapters/chuong-2')).toBeInTheDocument()
    expect(submitUserReport).not.toHaveBeenCalled()
  })

  it('queries the server for chapters outside the loaded TOC page', async () => {
    renderReader()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Điều hướng đầu chương' })).getByRole('button', { name: 'Mục lục' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '999' } })
    await waitFor(() => expect(state.tocQuery).toHaveBeenLastCalledWith('999'))
    expect(await screen.findByRole('link', { name: 'Chương 999' })).toHaveAttribute('href', '/stories/truyen-mau/chapters/chuong-999')
  })
  it('places matching previous/next controls before and after the chapter content', () => {
    renderReader()
    const top = screen.getByRole('navigation', { name: 'Điều hướng đầu chương' })
    const bottom = screen.getByRole('navigation', { name: 'Điều hướng cuối chương' })
    const content = screen.getByText('Nội dung chương thứ hai.')
    expect(top.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(content.compareDocumentPosition(bottom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const controls of [top, bottom]) {
      expect(within(controls).getByRole('link', { name: 'Trước' })).toHaveAttribute('href', '/stories/truyen-mau/chapters/chuong-1')
      expect(within(controls).getByRole('link', { name: 'Sau' })).toHaveAttribute('href', '/stories/truyen-mau/chapters/chuong-3')
    }
  })

  it('opens a separate contents dropdown and the shared comments drawer from the top controls', () => {
    renderReader()
    const top = screen.getByRole('navigation', { name: 'Điều hướng đầu chương' })
    const bottom = screen.getByRole('navigation', { name: 'Điều hướng cuối chương' })
    const topToc = within(top).getByRole('button', { name: 'Mục lục' })
    fireEvent.click(topToc)
    const contents = screen.getByRole('dialog', { name: 'Danh sách chương' })
    expect(within(contents).getByRole('link', { name: 'Chương 2' })).toHaveAttribute('aria-current', 'page')
    expect(topToc).toHaveAttribute('aria-controls', contents.id)
    expect(within(bottom).getByRole('button', { name: 'Mục lục' })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(within(contents).getByRole('button', { name: 'Đóng mục lục' }))
    fireEvent.click(within(top).getByRole('button', { name: 'Bình luận' }))
    expect(screen.getAllByRole('dialog', { name: 'Bình luận chương' })).toHaveLength(1)
  })

  it('disables navigation at chapter boundaries in both sets of controls', () => {
    state.data!.prevChapter = null
    state.data!.nextChapter = null
    renderReader()
    for (const label of ['Điều hướng đầu chương', 'Điều hướng cuối chương']) {
      const controls = screen.getByRole('navigation', { name: label })
      expect(within(controls).getByRole('button', { name: 'Trước' })).toBeDisabled()
      expect(within(controls).getByRole('button', { name: 'Sau' })).toBeDisabled()
    }
  })
})
