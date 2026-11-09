import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ReportsListPage from '../ReportsListPage'
import * as moderationApi from '../../api/moderation.api'
import { createMockReport } from '@/test/mockData'

vi.mock('../../api/moderation.api')

const mkClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

const renderPage = (client = mkClient()) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/mod/reports']}>
        <ReportsListPage />
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('ReportsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders report management title and status filter tabs', async () => {
    vi.mocked(moderationApi.fetchReports).mockResolvedValue({
      reports: [],
      meta: { limit: 20, nextCursor: null, hasMore: false },
    })

    renderPage()

    expect(screen.getByText('Báo Cáo Vi Phạm')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Chờ xử lý/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Đang xử lý/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Đã giải quyết/i })).toBeInTheDocument()
    expect(await screen.findByText(/Không có báo cáo nào/i)).toBeInTheDocument()
  })

  it('renders list of reports with details', async () => {
    const mockReport = createMockReport({
      _id: 'report-abc-1',
      targetType: 'story',
      reason: 'copyright',
      description: 'Truyện sao chép nguyên văn tác phẩm khác',
      status: 'pending',
    })

    vi.mocked(moderationApi.fetchReports).mockResolvedValue({
      reports: [mockReport],
      meta: { limit: 20, nextCursor: null, hasMore: false },
    })

    renderPage()

    expect(await screen.findByText('Vi phạm bản quyền')).toBeInTheDocument()
    expect(screen.getByText(/Truyện sao chép nguyên văn tác phẩm khác/i)).toBeInTheDocument()
    expect(screen.getAllByText('Chờ xử lý').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Xem chi tiết →')).toHaveAttribute('href', '/mod/reports/report-abc-1')
  })

  it('switches status tabs and queries with new status', async () => {
    vi.mocked(moderationApi.fetchReports).mockResolvedValue({
      reports: [],
      meta: { limit: 20, nextCursor: null, hasMore: false },
    })

    renderPage()

    const resolvedTab = screen.getByRole('tab', { name: /Đã giải quyết/i })
    fireEvent.click(resolvedTab)

    expect(moderationApi.fetchReports).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved' })
    )
  })
})
