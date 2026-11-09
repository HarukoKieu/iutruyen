import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import CrawlerImportPage from './CrawlerImportPage'

const mocks = vi.hoisted(() => ({ post: vi.fn(), approved: true }))
vi.mock('@/lib/axios', () => ({ axiosInstance: { post: mocks.post } }))
vi.mock('@/components/layout/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/features/auth/store/authStore', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { role: 'author', authorStatus: mocks.approved ? 'approved' : 'pending' } }) }))
vi.mock('@/features/stories/hooks/useStory', () => ({ useStoryById: () => ({ data: { _id: 'story', title: 'Truyện của tôi' }, isLoading: false }) }))
vi.mock('@/features/chapters/hooks/useChapters', () => ({ useChapters: () => ({ data: [{ order: 4 }], isLoading: false }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const preview = { title: 'Chương từ nguồn', text: 'Nội dung tự viết để kiểm thử <script> không thực thi.', wordCount: 12,
  sourceUrl: 'https://books.example.org/1', previewToken: 'token', expiresAt: '2030-01-01T00:00:00Z' }
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/author/stories/story/crawl']}>
    <Routes><Route path="/author/stories/:storyId/crawl" element={<CrawlerImportPage />} /></Routes>
  </MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { mocks.post.mockReset(); mocks.approved = true })
describe('crawler author workflow', () => {
  it('loads a catalog, previews the selected URL and persists only after confirmation', async () => {
    mocks.post.mockResolvedValueOnce({ data: { data: { title: 'Mục lục', sourceUrl: 'https://books.example.org/story', chapters: [{ title: 'Chương 1', url: preview.sourceUrl }], truncated: false }, meta: { nextCursor: null } } })
      .mockResolvedValueOnce({ data: { data: preview } })
      .mockResolvedValueOnce({ data: { data: { chapterId: 'saved', title: preview.title, order: 5, alreadyImported: false } } })
    mount()
    fireEvent.change(screen.getByLabelText('URL nguồn'), { target: { value: 'https://books.example.org/story' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lấy mục lục' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Chương 1' }))
    await screen.findByRole('heading', { name: 'Xem trước chương' })
    expect(screen.getByLabelText('Nội dung chương')).toHaveTextContent('<script> không thực thi.')
    expect(screen.getByLabelText('Số thứ tự chương')).toHaveValue(5)
    expect(screen.getByRole('button', { name: 'Lưu bản nháp' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bản nháp' }))
    expect(await screen.findByRole('link', { name: /Mở chương 5/ })).toHaveAttribute('href', '/author/stories/story/chapters/saved/edit')
    expect(mocks.post).toHaveBeenNthCalledWith(2, '/stories/story/crawl/preview', { url: preview.sourceUrl }, expect.anything())
    expect(mocks.post).toHaveBeenNthCalledWith(3, '/stories/story/crawl/import', { previewToken: 'token', title: preview.title, order: 5, rightsConfirmed: true }, expect.anything())
    expect(screen.getByRole('button', { name: 'Đã xử lý chương này' })).toBeDisabled()
  })
  it('shows API errors and allows retry instead of showing fixture content', async () => {
    mocks.post.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'Nguồn này chưa được bật.' } } })
      .mockResolvedValueOnce({ data: { data: preview } })
    mount()
    fireEvent.change(screen.getByLabelText('URL nguồn'), { target: { value: preview.sourceUrl } })
    fireEvent.click(screen.getByRole('button', { name: 'Xem chương từ URL' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nguồn này chưa được bật.')
    expect(screen.queryByLabelText('Nội dung chương')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xem chương từ URL' }))
    await screen.findByLabelText('Nội dung chương')
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
  it('keeps unapproved authors out of the import form', () => {
    mocks.approved = false; mount()
    expect(screen.getByRole('alert')).toHaveTextContent('cần được duyệt')
    expect(screen.queryByLabelText('URL nguồn')).not.toBeInTheDocument()
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it('explains that an existing chapter is preserved and does not proceed to import', async () => {
    mocks.post.mockRejectedValueOnce({ isAxiosError: true, response: { data: { code: 'CRAWLER_CHAPTER_EXISTS', message: 'Conflict' } } })
    mount()
    fireEvent.change(screen.getByLabelText('URL nguồn'), { target: { value: preview.sourceUrl } })
    fireEvent.click(screen.getByRole('button', { name: 'Xem chương từ URL' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Chương đã có trong truyện, giữ nguyên nội dung.')
    expect(screen.queryByRole('button', { name: 'Lưu bản nháp' })).not.toBeInTheDocument()
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.post).toHaveBeenCalledWith('/stories/story/crawl/preview', { url: preview.sourceUrl }, expect.anything())
  })
})
