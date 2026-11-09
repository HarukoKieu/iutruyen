import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ReportDetailPage from '../ReportDetailPage'
import * as moderationApi from '../../api/moderation.api'
import { createMockReport } from '@/test/mockData'

vi.mock('../../api/moderation.api')

const mkClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

const renderPage = (reportId = 'report-123', client = mkClient()) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/mod/reports/${reportId}`]}>
        <Routes>
          <Route path="/mod/reports/:id" element={<ReportDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('ReportDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders report details, reporter info, and reason', async () => {
    const mockReport = createMockReport({
      _id: 'report-123',
      targetType: 'story',
      reason: 'inappropriate_content',
      description: 'Nội dung chứa bạo lực không gắn nhãn cảnh báo.',
      status: 'pending',
    })

    vi.mocked(moderationApi.fetchReportDetail).mockResolvedValue({
      report: mockReport,
      targetData: {
        _id: 'story-123',
        title: 'Truyện Bị Báo Cáo',
        slug: 'truyen-bi-bao-cao',
        moderationStatus: 'pending',
      },
      stats: {
        targetOtherReportsCount: 2,
        reporterTotalReportsCount: 5,
      },
      targetAuditLogs: [],
    })

    renderPage('report-123')

    expect(await screen.findByText(/Báo cáo #/i)).toBeInTheDocument()
    expect(screen.getByText('Người Báo Cáo')).toBeInTheDocument()
    expect(screen.getByText(/Nội dung chứa bạo lực không gắn nhãn cảnh báo/i)).toBeInTheDocument()
    expect(screen.getByText('Truyện Bị Báo Cáo')).toBeInTheDocument()
  })

  it('processes action on report and executes API call', async () => {
    const mockReport = createMockReport({
      _id: 'report-123',
      status: 'pending',
    })

    vi.mocked(moderationApi.fetchReportDetail).mockResolvedValue({
      report: mockReport,
      targetData: { _id: 'story-123', title: 'Truyện Vi Phạm' },
      stats: { targetOtherReportsCount: 0, reporterTotalReportsCount: 1 },
      targetAuditLogs: [],
    })
    vi.mocked(moderationApi.submitReportAction).mockResolvedValue(mockReport)

    renderPage('report-123')

    expect(await screen.findByText('⚡ Xử lý báo cáo')).toBeInTheDocument()

    // Select "Ẩn nội dung" action button
    const hideBtn = screen.getByRole('button', { name: /Ẩn nội dung/i })
    fireEvent.click(hideBtn)

    // Fill in note
    const textarea = screen.getByPlaceholderText(/Ghi chú thêm cho quyết định này/i)
    fireEvent.change(textarea, { target: { value: 'Ẩn do vi phạm quy tắc cộng đồng' } })

    // Submit action
    const submitBtn = screen.getByRole('button', { name: /Xác nhận hành động/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(moderationApi.submitReportAction).toHaveBeenCalledWith('report-123', {
        action: 'hide',
        note: 'Ẩn do vi phạm quy tắc cộng đồng',
        notifyUser: true,
        suspendDays: undefined,
      })
    })
  })

  it('allows adding an internal note', async () => {
    const mockReport = createMockReport({
      _id: 'report-123',
      status: 'pending',
      notes: [],
    })

    vi.mocked(moderationApi.fetchReportDetail).mockResolvedValue({
      report: mockReport,
      targetData: null,
      stats: { targetOtherReportsCount: 0, reporterTotalReportsCount: 0 },
      targetAuditLogs: [],
    })
    vi.mocked(moderationApi.addReportNote).mockResolvedValue(mockReport)

    renderPage('report-123')

    const noteInput = await screen.findByPlaceholderText(/Ghi chú cho nhóm kiểm duyệt/i)
    fireEvent.change(noteInput, { target: { value: 'Đang đợi tác giả giải trình' } })

    const addNoteBtn = screen.getByRole('button', { name: /Thêm ghi chú/i })
    fireEvent.click(addNoteBtn)

    await waitFor(() => {
      expect(moderationApi.addReportNote).toHaveBeenCalledWith('report-123', 'Đang đợi tác giả giải trình')
    })
  })
})
