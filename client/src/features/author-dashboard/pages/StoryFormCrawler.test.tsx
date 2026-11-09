import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { StoryFormPage } from './StoryFormPage'

const mocks = vi.hoisted(() => ({ metadata: vi.fn(), create: vi.fn(), update: vi.fn(), hasStoryError: false, refetchStory: vi.fn(), existingStory: null as Record<string, unknown> | null }))
vi.mock('@/components/layout/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/features/stories/hooks/useGenres', () => ({ useGenres: () => ({ data: [{ _id: 'genre-1', name: 'Ngôn Tình' }] }) }))
vi.mock('@/features/stories/hooks/useTags', () => ({ useTags: () => ({ data: [] }) }))
vi.mock('@/features/stories/hooks/useStory', () => ({ useStoryById: () => ({ data: mocks.existingStory ?? undefined, isError: mocks.hasStoryError, refetch: mocks.refetchStory }) }))
vi.mock('@/features/stories/hooks/useStoryMutations', () => ({
  useCreateStory: () => ({ mutateAsync: mocks.create, isPending: false }),
  useUpdateStory: () => ({ mutate: mocks.update, mutateAsync: mocks.update, reset: vi.fn(), isPending: false }),
}))
vi.mock('@/features/chapters/api/crawler.api', () => ({ crawlerApi: { metadata: mocks.metadata }, crawlErrorMessage: (error: { message?: string; response?: { data?: { message?: string } } }) => error.response?.data?.message || error.message || 'Không thực hiện được thao tác.' }))
const sourceUrl = 'https://books.example/story/'
function Destination() { const location = useLocation(); return <p>Nhập chương tiếp: {location.state?.sourceUrl}</p> }
function mount(initialEntry = '/author/stories/new') {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={[initialEntry]}><Routes>
      <Route path="/author/stories/new" element={<StoryFormPage />} />
      <Route path="/author/stories/:id/edit" element={<StoryFormPage />} />
      <Route path="/author/stories" element={<p>Danh sách truyện của tôi</p>} />
      <Route path="/author/crawl" element={<Destination />} />
      <Route path="/author/stories/created/crawl" element={<Destination />} />
    </Routes></MemoryRouter>
  </QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.existingStory = null
  mocks.hasStoryError = false
  mocks.metadata.mockResolvedValue({ sourceUrl, story: { title: 'Truyện từ nguồn', description: 'Giới thiệu đủ dài.',
    author: 'Người viết', genres: ['Ngôn Tình'], status: 'completed', rawStatus: 'Hoàn thành', truncated: false } })
  mocks.create.mockResolvedValue({ _id: 'created' })
})
it('does not expose a blank edit form when the story request fails and allows retry', () => {
  mocks.hasStoryError = true
  mount('/author/stories/existing/edit')
  expect(screen.getByRole('alert')).toHaveTextContent('Không tải được thông tin truyện')
  expect(screen.queryByLabelText('Tên truyện *')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(mocks.refetchStory).toHaveBeenCalledTimes(1)
  expect(mocks.update).not.toHaveBeenCalled()
})
it('fills the new-story form only after review, creates once on submit and carries the URL into chapter import', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('Tên truyện *'), { target: { value: 'Đang viết' } })
  fireEvent.change(screen.getByLabelText('URL truyện nguồn'), { target: { value: sourceUrl } })
  fireEvent.click(screen.getByRole('button', { name: 'Lấy thông tin truyện' }))
  await screen.findByRole('heading', { name: 'Thông tin truyện từ nguồn' })
  expect(screen.getByLabelText('Tên truyện *')).toHaveValue('Đang viết')
  expect(mocks.create).not.toHaveBeenCalled()
  fireEvent.click(screen.getByLabelText('Áp dụng thể loại'))
  fireEvent.click(screen.getByLabelText(/Tôi có quyền/))
  fireEvent.click(screen.getByRole('button', { name: 'Điền vào form tạo truyện' }))
  expect(screen.getByLabelText('Tên truyện *')).toHaveValue('Truyện từ nguồn')
  expect(screen.getByLabelText('Mô tả / Giới thiệu *')).toHaveValue(`Giới thiệu đủ dài.\n\nTác giả gốc: Người viết\nNguồn: books.example`)
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Tạo truyện' }))
  await screen.findByText(`Nhập chương tiếp: ${sourceUrl}`)
  expect(mocks.create).toHaveBeenCalledTimes(1)
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Truyện từ nguồn', genreIds: ['genre-1'], status: 'completed', crawlerSourceUrl: sourceUrl }))
})
it('retains typed data when crawling fails and allows retry', async () => {
  mocks.metadata.mockRejectedValueOnce(new Error('Nguồn chưa được bật'))
  mount()
  fireEvent.change(screen.getByLabelText('Tên truyện *'), { target: { value: 'Đang viết' } })
  fireEvent.change(screen.getByLabelText('URL truyện nguồn'), { target: { value: sourceUrl } })
  fireEvent.click(screen.getByRole('button', { name: 'Lấy thông tin truyện' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nguồn chưa được bật')
  expect(screen.getByLabelText('Tên truyện *')).toHaveValue('Đang viết')
  fireEvent.click(screen.getByRole('button', { name: 'Lấy thông tin truyện' }))
  await screen.findByRole('heading', { name: 'Thông tin truyện từ nguồn' })
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(mocks.create).not.toHaveBeenCalled()
})

it.each(['', 'https://books.example/other-story/'])('drops the applied source binding when the URL is changed to %s', async url => {
  mount()
  fireEvent.change(screen.getByLabelText('URL truyện nguồn'), { target: { value: sourceUrl } })
  fireEvent.click(screen.getByRole('button', { name: 'Lấy thông tin truyện' }))
  await screen.findByRole('heading', { name: 'Thông tin truyện từ nguồn' })
  fireEvent.click(screen.getByLabelText('Áp dụng thể loại'))
  fireEvent.click(screen.getByLabelText(/Tôi có quyền/))
  fireEvent.click(screen.getByRole('button', { name: 'Điền vào form tạo truyện' }))
  fireEvent.change(screen.getByLabelText('URL truyện nguồn'), { target: { value: url } })
  fireEvent.click(screen.getByRole('button', { name: 'Tạo truyện' }))
  await screen.findByText('Danh sách truyện của tôi')
  expect(mocks.create).toHaveBeenCalledTimes(1)
  expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('crawlerSourceUrl')
})

it('keeps ordinary manual creation free of crawler source fields', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('Tên truyện *'), { target: { value: 'Truyện tự viết' } })
  fireEvent.change(screen.getByLabelText('Mô tả / Giới thiệu *'), { target: { value: 'Giới thiệu đủ dài cho truyện tự viết.' } })
  fireEvent.click(screen.getByText('Ngôn Tình'))
  fireEvent.click(screen.getByRole('button', { name: 'Tạo truyện' }))
  await screen.findByText('Danh sách truyện của tôi')
  expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('crawlerSourceUrl')
})

it('does not attach a crawler source URL when editing a story', async () => {
  mocks.existingStory = { _id: 'existing', title: 'Truyện đã có', description: 'Giới thiệu hiện tại đủ dài.', genreIds: [{ _id: 'genre-1', name: 'Ngôn Tình' }], tagIds: [], status: 'ongoing', contentWarning: 'none' }
  mount('/author/stories/existing/edit')
  fireEvent.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }))
  await screen.findByText('Danh sách truyện của tôi')
  expect(mocks.update).toHaveBeenCalledTimes(1)
  expect(mocks.update.mock.calls[0][0].input).not.toHaveProperty('crawlerSourceUrl')
  expect(mocks.create).not.toHaveBeenCalled()
})

it('offers bulk chapter import when metadata reports an already-known story without creating anything', async () => {
  mocks.metadata.mockRejectedValueOnce({ isAxiosError: true, response: { data: { code: 'CRAWLER_STORY_EXISTS', message: 'Truyện đã có trên hệ thống.' } } })
  mount()
  fireEvent.change(screen.getByLabelText('URL truyện nguồn'), { target: { value: sourceUrl } })
  fireEvent.click(screen.getByRole('button', { name: 'Lấy thông tin truyện' }))
  const link = await screen.findByRole('link', { name: 'Nhập các chương còn thiếu' })
  expect(link).toHaveAttribute('href', '/author/crawl')
  expect(screen.queryByRole('button', { name: 'Điền vào form tạo truyện' })).not.toBeInTheDocument()
  fireEvent.click(link)
  await screen.findByText(`Nhập chương tiếp: ${sourceUrl}`)
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
})
