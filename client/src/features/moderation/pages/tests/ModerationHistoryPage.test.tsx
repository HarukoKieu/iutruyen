import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ModerationHistoryPage from '../ModerationHistoryPage'
import * as moderationApi from '../../api/moderation.api'
import { createMockModerationLog } from '@/test/mockData'

vi.mock('../../api/moderation.api')

const mkClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

const renderPage = (client = mkClient()) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/mod/history']}>
        <ModerationHistoryPage />
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('ModerationHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders history title and empty state when no logs exist', async () => {
    vi.mocked(moderationApi.fetchModerationHistory).mockResolvedValue({
      logs: [],
      meta: { limit: 30, nextCursor: null, hasMore: false },
    })

    renderPage()

    expect(screen.getByText('Lịch Sử Kiểm Duyệt')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '7 ngày' })).toBeInTheDocument()
    expect(await screen.findByText('Không có nhật ký nào trong khoảng thời gian này.')).toBeInTheDocument()
  })

  it('renders log entries with moderator, action, and target title', async () => {
    const mockLog = createMockModerationLog({
      _id: 'log-1',
      action: 'approve_story',
      targetType: 'story',
      targetTitle: 'Nghịch Thiên Tà Thần',
      reason: 'Đã kiểm duyệt xong nội dung',
    })

    vi.mocked(moderationApi.fetchModerationHistory).mockResolvedValue({
      logs: [mockLog],
      meta: { limit: 30, nextCursor: null, hasMore: false },
    })

    renderPage()

    expect(await screen.findByText('Kiểm Duyệt Viên 1')).toBeInTheDocument()
    expect(screen.getAllByText('Duyệt truyện').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Nghịch Thiên Tà Thần')).toBeInTheDocument()
    expect(screen.getByText(/Đã kiểm duyệt xong nội dung/i)).toBeInTheDocument()
  })

  it('updates query when changing time range filter', async () => {
    vi.mocked(moderationApi.fetchModerationHistory).mockResolvedValue({
      logs: [],
      meta: { limit: 30, nextCursor: null, hasMore: false },
    })

    renderPage()

    const rangeBtn = screen.getByRole('tab', { name: '24 giờ' })
    fireEvent.click(rangeBtn)

    expect(moderationApi.fetchModerationHistory).toHaveBeenCalledWith(
      expect.objectContaining({ range: '24h' })
    )
  })
})
