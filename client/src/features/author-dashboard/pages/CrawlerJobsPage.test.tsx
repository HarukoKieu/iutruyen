import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { CrawlerJob, CrawlerJobStatus, CrawlerTask } from '@/types/crawler-job'
import { queryKeys } from '@/constants/queryKeys'
import CrawlerJobsPage from './CrawlerJobsPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), approved: true }))
vi.mock('@/lib/axios', () => ({ api: { get: mocks.get, post: mocks.post }, axiosInstance: { get: mocks.get, post: mocks.post } }))
vi.mock('@/components/layout/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/features/auth/store/authStore', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { id: 'actor', role: 'author', authorStatus: mocks.approved ? 'approved' : 'pending' } }) }))
vi.mock('@/features/stories/hooks/useGenres', () => ({ useGenres: () => ({ data: [{ _id: '333333333333333333333333', name: 'Tiên hiệp' }], isLoading: false, error: null }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const storyId = '111111111111111111111111'
const secondStoryId = '222222222222222222222222'
const base = '/stories/crawl/jobs'
const meta = { limit: 20, hasMore: false, nextCursor: null }
const task: CrawlerTask = { id: 'task-1', sourceIndex: 0, title: 'Chương mẫu', url: 'https://books.example.org/story/chapter-1', position: 1, order: 1, status: 'pending', attempts: 0 }
let currentJob: CrawlerJob
let hasTaskNext = false
const clients: QueryClient[] = []
function makeJob(status: CrawlerJobStatus): CrawlerJob {
  return { id: 'job-1', actorId: 'actor', status, phase: status === 'planning' || status === 'ready' ? 'planning' : 'importing', active: !['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(status),
    counters: { total: 2, pending: 2, succeeded: 0, skipped: 0, failed: 0 }, createdAt: '2026-10-14T02:00:00Z', updatedAt: '2026-10-14T02:00:00Z',
    sources: [{ url: 'https://books.example.org/story', destination: 'existing', storyId, genreIds: [], from: 1, to: 2000, startOrder: 1,
      metadata: { title: 'Truyện nguồn', description: 'Giới thiệu để kiểm thử', originalAuthor: 'Tác giả nguồn' },
      discovery: { pageCount: 1, chapterCount: 2, complete: status !== 'planning' }, warning: 'Chỉ xử lý mục lục trên trang được cung cấp.' }] }
}
function LocationView() { return <output aria-label="Địa chỉ hiện tại">{useLocation().search}</output> }
function mount(initialEntry = '/author/crawl') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[initialEntry]}><CrawlerJobsPage /><LocationView /></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  mocks.get.mockReset(); mocks.post.mockReset(); mocks.approved = true; currentJob = makeJob('ready'); hasTaskNext = false
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  mocks.get.mockImplementation(async (url: string, config?: { params?: { cursor?: string; q?: string; status?: string } }) => {
    if (url === '/stories/crawl/targets') return { data: { data: [{ id: config?.params?.cursor ? secondStoryId : storyId, title: config?.params?.cursor ? 'Truyện trang sau' : 'Truyện đã có' }], meta: { ...meta, hasMore: !config?.params?.cursor, nextCursor: config?.params?.cursor ? null : 'story-next' } } }
    if (url === base) return { data: { data: [currentJob], meta } }
    if (url === `${base}/job-1`) return { data: { data: currentJob } }
    if (url === `${base}/job-1/tasks`) return { data: { data: [{ ...task, id: config?.params?.cursor ? 'task-2' : task.id, title: config?.params?.cursor ? 'Chương trang sau' : task.title,
      status: config?.params?.status || task.status, ...(config?.params?.status === 'failed' ? { errorCode: 'CHAPTER_ORDER_CONFLICT' } : {}) }], meta: { ...meta, hasMore: hasTaskNext && !config?.params?.cursor, nextCursor: hasTaskNext && !config?.params?.cursor ? 'task-next' : null } } }
    throw new Error(`Unexpected endpoint ${url}`)
  })
  mocks.post.mockImplementation(async (_url: string, input: { action?: string }) => {
    const states: Record<string, CrawlerJobStatus> = { start: 'running', pause: 'paused', resume: 'queued', cancel: 'cancelled', retry: 'queued' }
    if (input.action) currentJob = { ...currentJob, status: states[input.action], phase: 'importing' }
    return { data: { data: currentJob } }
  })
})
afterEach(() => { vi.useRealTimers(); clients.splice(0).forEach(client => client.clear()); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }) })

describe('bulk crawler author workflow', () => {
  it('prepares multiple destinations, preserves a failed request and requires confirmation before importing', async () => {
    mocks.post.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'Kết nối tạm thời gián đoạn.' } } })
    mount()
    await screen.findByRole('button', { name: 'Tải thêm truyện' })
    fireEvent.change(screen.getByLabelText('URL truyện nguồn 1'), { target: { value: 'https://books.example.org/story' } })
    fireEvent.change(screen.getByLabelText('Đích nhập nguồn 1'), { target: { value: 'existing' } })
    fireEvent.change(screen.getByLabelText('Truyện đã có nguồn 1'), { target: { value: storyId } })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nguồn truyện' }))
    fireEvent.change(screen.getByLabelText('URL truyện nguồn 2'), { target: { value: 'https://books.example.org/second-story' } })
    fireEvent.change(screen.getByLabelText('Đích nhập nguồn 2'), { target: { value: 'new' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tiên hiệp' }))
    fireEvent.change(screen.getByLabelText('Từ vị trí nguồn 2'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Đến vị trí nguồn 2'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Số chương đích đầu tiên nguồn 2'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lấy kế hoạch nhập' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Kết nối tạm thời gián đoạn')
    expect(screen.getByLabelText('URL truyện nguồn 2')).toHaveValue('https://books.example.org/second-story')
    fireEvent.click(screen.getByRole('button', { name: 'Lấy kế hoạch nhập' }))
    await screen.findByRole('heading', { name: 'Chi tiết đợt nhập' })
    const firstInput = mocks.post.mock.calls[0][1]
    expect(firstInput.requestKey).toMatch(/^[0-9a-f-]{36}$/i)
    expect(mocks.post.mock.calls[1][1]).toEqual(firstInput)
    expect(firstInput.sources).toEqual([
      { url: 'https://books.example.org/story', storyId, from: 1, to: 2000, startOrder: 1 },
      { url: 'https://books.example.org/second-story', genreIds: ['333333333333333333333333'], from: 2, to: 4, startOrder: 7 },
    ])
    expect(screen.getByLabelText('Địa chỉ hiện tại')).toHaveTextContent('jobId=job-1')
    expect(screen.getByRole('button', { name: 'Bắt đầu nhập' })).toBeDisabled()
    expect(mocks.post).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('checkbox', { name: /Tôi có quyền sử dụng/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu nhập' }))
    await waitFor(() => expect(mocks.post).toHaveBeenLastCalledWith(`${base}/job-1/control`, { action: 'start', rightsConfirmed: true }, expect.anything()))
    expect(await screen.findByRole('button', { name: 'Tạm dừng' })).toBeEnabled()
  })

  it('loads a selected job after reopening and lets failed controls retry without losing progress', async () => {
    currentJob = makeJob('running')
    mocks.post.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'Chưa thể tạm dừng.' } } })
    mount('/author/crawl?jobId=job-1')
    fireEvent.click(await screen.findByRole('button', { name: 'Tạm dừng' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tạm dừng')
    expect(screen.getByRole('progressbar', { name: 'Tiến độ nhập chương' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục' }))
    await screen.findByRole('button', { name: 'Tạm dừng' })
    fireEvent.click(screen.getByRole('button', { name: 'Hủy đợt nhập' }))
    expect(mocks.post.mock.calls.map(call => call[1].action)).toEqual(['pause', 'pause', 'resume'])
    expect(screen.getByText(/Những truyện và chương đã lưu được giữ nguyên/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hủy đợt nhập' })).not.toBeInTheDocument())
    expect(mocks.post).toHaveBeenLastCalledWith(`${base}/job-1/control`, { action: 'cancel' }, expect.anything())
  })

  it('shows source warnings and chapter errors, filters/paginates tasks and retries only a failed job', async () => {
    currentJob = makeJob('completed_with_errors'); hasTaskNext = true
    currentJob.counters = { total: 2, succeeded: 1, skipped: 0, failed: 1, pending: 0 }
    mount('/author/crawl?jobId=job-1')
    await screen.findByText('Chỉ xử lý mục lục trên trang được cung cấp.')
    await screen.findByText('Chương mẫu')
    fireEvent.click(screen.getByRole('button', { name: '50 chương tiếp theo' }))
    await screen.findByText('Chương trang sau')
    expect(mocks.get).toHaveBeenCalledWith(`${base}/job-1/tasks`, expect.objectContaining({ params: { cursor: 'task-next', status: undefined, limit: 50 } }))
    expect(screen.queryByText('Chương mẫu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Về đầu danh sách' }))
    await screen.findByText('Chương mẫu')
    fireEvent.change(screen.getByLabelText('Lọc chương'), { target: { value: 'failed' } })
    expect(await screen.findByText(/Số chương đích đã được sử dụng/)).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith(`${base}/job-1/tasks`, expect.objectContaining({ params: { cursor: undefined, status: 'failed', limit: 50 } }))
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại phần lỗi' }))
    await waitFor(() => expect(mocks.post).toHaveBeenLastCalledWith(`${base}/job-1/control`, { action: 'retry' }, expect.anything()))
  })

  it('searches and paginates lightweight destination stories and rejects duplicate destinations', async () => {
    mount()
    fireEvent.change(screen.getByLabelText('Đích nhập nguồn 1'), { target: { value: 'existing' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Tải thêm truyện' }))
    await screen.findByRole('option', { name: 'Truyện trang sau' })
    expect(mocks.get).toHaveBeenCalledWith('/stories/crawl/targets', expect.objectContaining({ params: expect.objectContaining({ cursor: 'story-next' }) }))
    fireEvent.change(screen.getByLabelText('Tìm truyện đã có'), { target: { value: 'Tên truyện' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tìm truyện' }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/stories/crawl/targets', expect.objectContaining({ params: { q: 'Tên truyện', cursor: undefined, limit: 20 } })))
    fireEvent.change(screen.getByLabelText('URL truyện nguồn 1'), { target: { value: 'https://books.example.org/first' } })
    fireEvent.change(screen.getByLabelText('Đích nhập nguồn 1'), { target: { value: 'existing' } })
    fireEvent.change(screen.getByLabelText('Truyện đã có nguồn 1'), { target: { value: storyId } })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nguồn truyện' }))
    fireEvent.change(screen.getByLabelText('URL truyện nguồn 2'), { target: { value: 'https://books.example.org/second' } })
    fireEvent.change(screen.getByLabelText('Đích nhập nguồn 2'), { target: { value: 'existing' } })
    fireEvent.change(screen.getByLabelText('Đích nhập nguồn 2'), { target: { value: 'existing' } })
    fireEvent.change(screen.getByLabelText('Truyện đã có nguồn 2'), { target: { value: storyId } })
    fireEvent.click(screen.getByRole('button', { name: 'Lấy kế hoạch nhập' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('mỗi truyện đích chỉ được chọn một lần')
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('pastes multiple URLs with shared defaults and refuses more than twenty sources', async () => {
    mount(); await screen.findByRole('button', { name: 'Tải thêm truyện' })
    fireEvent.change(screen.getByLabelText('Đích nhập nguồn 1'), { target: { value: 'new' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tiên hiệp' }))
    fireEvent.change(screen.getByLabelText('Từ vị trí nguồn 1'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Đến vị trí nguồn 1'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Dán nhiều URL (mỗi dòng một truyện)'), { target: { value: 'https://books.example.org/one\nhttps://books.example.org/two\nhttps://books.example.org/three' } })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm các URL' }))
    expect(screen.getByLabelText('URL truyện nguồn 3')).toHaveValue('https://books.example.org/three')
    expect(screen.getByLabelText('Đích nhập nguồn 3')).toHaveValue('new')
    expect(screen.getByLabelText('Từ vị trí nguồn 3')).toHaveValue(2)
    expect(screen.getAllByRole('checkbox', { name: 'Tiên hiệp' })).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Lấy kế hoạch nhập' }))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1))
    expect(mocks.post.mock.calls[0][1].sources).toHaveLength(3)
    expect(mocks.post.mock.calls[0][1].sources.every((source: { genreIds: string[] }) => source.genreIds[0] === '333333333333333333333333')).toBe(true)
    await screen.findByRole('heading', { name: 'Chi tiết đợt nhập' })
    fireEvent.change(screen.getByLabelText('Dán nhiều URL (mỗi dòng một truyện)'), { target: { value: Array.from({ length: 20 }, (_, index) => `https://books.example.org/more-${index}`).join('\n') } })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm các URL' }))
    expect(screen.getByRole('alert')).toHaveTextContent('tối đa 20 nguồn')
    expect(screen.queryByLabelText('URL truyện nguồn 4')).not.toBeInTheDocument()
  })

  it('defaults to source recognition and sends no empty genres when an existing story can be reused', async () => {
    currentJob.sources[0].reusedExisting = true
    mount()
    expect(screen.getByLabelText('Đích nhập nguồn 1')).toHaveValue('new')
    expect(screen.getByRole('option', { name: 'Tự nhận diện hoặc tạo mới' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('URL truyện nguồn 1'), { target: { value: 'https://books.example.org/story' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lấy kế hoạch nhập' }))
    await screen.findByText('Đã nhận diện truyện có sẵn')
    expect(mocks.post).toHaveBeenCalledWith(base, {
      requestKey: expect.any(String), sources: [{ url: 'https://books.example.org/story', from: 1, to: 2000, startOrder: 1 }],
    }, expect.anything())
    expect(screen.getByRole('link', { name: 'Quản lý chương nguồn 1' })).toHaveAttribute('href', `/author/stories/${storyId}/chapters`)
    expect(screen.getByRole('button', { name: 'Bắt đầu nhập' })).toBeDisabled()
    expect(mocks.post).toHaveBeenCalledTimes(1)
  })

  it('preselects the existing destination when opened from a story bulk-entry link', async () => {
    mount(`/author/crawl?storyId=${storyId}`)
    expect(screen.getByLabelText('Đích nhập nguồn 1')).toHaveValue('existing')
    expect(screen.getByLabelText('Truyện đã có nguồn 1')).toHaveValue(storyId)
    fireEvent.change(screen.getByLabelText('URL truyện nguồn 1'), { target: { value: 'https://books.example.org/story' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lấy kế hoạch nhập' }))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(base, expect.objectContaining({
      sources: [{ url: 'https://books.example.org/story', storyId, from: 1, to: 2000, startOrder: 1 }],
    }), expect.anything()))
  })

  it('explains an occupied destination order without treating it as the same source chapter', async () => {
    currentJob = makeJob('completed')
    currentJob.counters = { total: 2, skipped: 2, succeeded: 0, failed: 0, pending: 0 }
    const originalGet = mocks.get.getMockImplementation()
    mocks.get.mockImplementation((url: string, config: unknown) => url === `${base}/job-1/tasks`
      ? Promise.resolve({ data: { data: [
        { ...task, status: 'skipped', title: 'Chương đã nhập từ URL này', chapterId: 'old-chapter' },
        { ...task, id: 'order-only', status: 'skipped', title: 'Chương từ URL khác', errorCode: 'CHAPTER_ORDER_EXISTS', chapterId: 'occupied-order' },
      ], meta } }) : originalGet?.(url, config))
    mount('/author/crawl?jobId=job-1')
    await screen.findByText('URL chương này đã có trong truyện. Giữ nguyên nội dung hiện tại.')
    const orderCard = (await screen.findByText('Chương từ URL khác')).closest('li') as HTMLElement
    expect(within(orderCard).getByText('Số chương đích đã có nội dung. Đã bỏ qua vị trí này và giữ nguyên chương hiện tại.')).toBeInTheDocument()
    expect(within(orderCard).queryByText('URL chương này đã có trong truyện. Giữ nguyên nội dung hiện tại.')).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bỏ qua' })).toHaveValue('skipped')
  })

  it('shows a globally existing source as skipped without exposing destination metadata or controls', async () => {
    currentJob = makeJob('completed')
    currentJob.phase = 'planning'
    currentJob.counters = { total: 0, pending: 0, succeeded: 0, skipped: 0, failed: 0 }
    currentJob.sources[0] = { ...currentJob.sources[0], destination: 'new', skipReason: 'CRAWLER_STORY_EXISTS', storyId: undefined, metadata: undefined }
    const originalGet = mocks.get.getMockImplementation()
    mocks.get.mockImplementation((url: string, config: unknown) => url === `${base}/job-1/tasks`
      ? Promise.resolve({ data: { data: [], meta } }) : originalGet?.(url, config))
    mount('/author/crawl?jobId=job-1')
    await screen.findByText('Truyện đã có trên hệ thống · Bỏ qua nguồn')
    const source = screen.getByRole('region', { name: 'Thông tin và phạm vi nguồn' })
    expect(within(source).queryByRole('link', { name: /Quản lý chương/ })).not.toBeInTheDocument()
    expect(within(source).queryByText('Xem thông tin truyện từ nguồn')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bắt đầu nhập' })).not.toBeInTheDocument()
    expect(await screen.findByText('Các nguồn trong đợt này đều đã có trên hệ thống nên được bỏ qua.')).toBeInTheDocument()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('stops polling hidden pages and completed jobs', async () => {
    currentJob = makeJob('running')
    const mounted = mount('/author/crawl?jobId=job-1')
    await screen.findByText('Chương mẫu')
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    mocks.get.mockClear()
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(mocks.get).not.toHaveBeenCalled()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(mocks.get).toHaveBeenCalledWith(`${base}/job-1`, expect.anything())
    vi.useRealTimers(); mounted.unmount()
    currentJob = makeJob('completed')
    mount('/author/crawl?jobId=job-1')
    await screen.findByText('Chương mẫu')
    vi.useFakeTimers(); mocks.get.mockClear()
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('does not request or prepare jobs for an unapproved author', () => {
    mocks.approved = false; mount('/author/crawl?jobId=job-1')
    expect(screen.getByRole('alert')).toHaveTextContent('cần được duyệt')
    expect(screen.queryByLabelText('URL truyện nguồn 1')).not.toBeInTheDocument()
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled()
  })

  it('shows separate progress for each story using source counters rather than the batch total', async () => {
    currentJob = makeJob('running')
    currentJob.counters = { total: 5, succeeded: 3, skipped: 0, failed: 1, pending: 1 }
    currentJob.sources[0].counters = { total: 3, succeeded: 3, skipped: 0, failed: 0, pending: 0 }
    currentJob.sources.push({ ...currentJob.sources[0], url: 'https://books.example.org/other-story', storyId: secondStoryId,
      metadata: { title: 'Truyện nguồn thứ hai', description: 'Giới thiệu kiểm thử nguồn thứ hai' },
      counters: { total: 2, succeeded: 0, skipped: 0, failed: 1, pending: 1 } })
    mount('/author/crawl?jobId=job-1')
    const first = await screen.findByRole('group', { name: 'Kết quả nhập nguồn 1' })
    const second = screen.getByRole('group', { name: 'Kết quả nhập nguồn 2' })
    expect(within(first).getByText('Kế hoạch: 3 chương')).toBeInTheDocument()
    expect(within(second).getByText('Kế hoạch: 2 chương')).toBeInTheDocument()
    expect(within(first).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
    expect(within(first).getByRole('progressbar')).toHaveAttribute('aria-valuemax', '3')
    expect(within(second).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    expect(within(second).getByRole('progressbar')).toHaveAttribute('aria-valuemax', '2')
    expect(screen.getByRole('progressbar', { name: 'Tiến độ nhập chương' })).toHaveAttribute('aria-valuemax', '5')
  })

  it.each(['ready', 'paused'] as const)('keeps idle %s jobs from polling', async status => {
    currentJob = makeJob(status); mount('/author/crawl?jobId=job-1')
    await screen.findByText('Chương mẫu')
    vi.useFakeTimers(); mocks.get.mockClear()
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it.each(['ready', 'paused', 'completed'] as const)('refreshes the last chapter page when a working job becomes %s without a local action', async status => {
    currentJob = makeJob(status === 'ready' ? 'planning' : 'running')
    currentJob.sources[0].counters = { total: 2, pending: 2, succeeded: 0, skipped: 0, failed: 0 }
    currentJob.sources.push({ ...currentJob.sources[0], url: 'https://books.example.org/second-story', storyId: secondStoryId,
      metadata: { title: 'Truyện nguồn thứ hai', description: 'Giới thiệu kiểm thử nguồn thứ hai' },
      discovery: { pageCount: 0, chapterCount: 0, complete: false }, counters: { total: 0, pending: 0, succeeded: 0, skipped: 0, failed: 0 } })
    let taskRows: CrawlerTask[] = [
      { ...task, title: 'Nguồn 1 chương 1' },
      { ...task, id: 'task-2', title: 'Nguồn 1 chương 2', position: 2, order: 2 },
    ]
    const originalGet = mocks.get.getMockImplementation()
    mocks.get.mockImplementation((url: string, config: unknown) => url === `${base}/job-1/tasks`
      ? Promise.resolve({ data: { data: taskRows, meta } }) : originalGet?.(url, config))
    mount('/author/crawl?jobId=job-1')
    await screen.findByText('Nguồn 1 chương 2')
    expect(screen.queryByText('Nguồn 2 chương 1')).not.toBeInTheDocument()
    taskRows = [...taskRows,
      { ...task, id: 'task-3', sourceIndex: 1, title: 'Nguồn 2 chương 1' },
      { ...task, id: 'task-4', sourceIndex: 1, title: 'Nguồn 2 chương 2', position: 2, order: 2 },
    ].map(row => ({ ...row, status: status === 'completed' ? 'succeeded' : 'pending' }))
    currentJob = { ...currentJob, status, counters: { total: 4, pending: status === 'completed' ? 0 : 4, succeeded: status === 'completed' ? 4 : 0, skipped: 0, failed: 0 },
      sources: currentJob.sources.map(source => ({ ...source, discovery: { pageCount: 1, chapterCount: 2, complete: true },
        counters: { total: 2, pending: status === 'completed' ? 0 : 2, succeeded: status === 'completed' ? 2 : 0, skipped: 0, failed: 0 } })) }
    act(() => clients[clients.length - 1].setQueryData(queryKeys.crawlerJobs.detail('actor', 'job-1'), currentJob))
    await screen.findByText('Nguồn 2 chương 1')
    await screen.findByText('Nguồn 2 chương 2')
    expect(screen.getAllByRole('link', { name: 'Mở chương tại nguồn' })).toHaveLength(4)
    expect(mocks.post).not.toHaveBeenCalled()
    vi.useFakeTimers(); mocks.get.mockClear()
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(mocks.get).not.toHaveBeenCalledWith(`${base}/job-1/tasks`, expect.anything())
  })
})
