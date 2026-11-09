import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReportModal from '../ReportModal'
import * as moderationApi from '../../api/moderation.api'

vi.mock('../../api/moderation.api')

const mkClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

const renderModal = (props: React.ComponentProps<typeof ReportModal>, client = mkClient()) =>
  render(
    <QueryClientProvider client={client}>
      <ReportModal {...props} />
    </QueryClientProvider>
  )

describe('ReportModal', () => {
  const defaultProps = {
    isOpen: true,
    targetType: 'story' as const,
    targetId: 'story-123',
    targetTitle: 'Đại Quản Gia Là Ma Hoàng',
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when isOpen is false', () => {
    renderModal({ ...defaultProps, isOpen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders target title and reason chips when open', () => {
    renderModal(defaultProps)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Đại Quản Gia Là Ma Hoàng')).toBeInTheDocument()
    expect(screen.getByText(/Nội dung không phù hợp/i)).toBeInTheDocument()
    expect(screen.getByText(/Spam hoặc quảng cáo/i)).toBeInTheDocument()
  })

  it('disables submit button initially until a reason is selected', () => {
    renderModal(defaultProps)
    const submitBtn = screen.getByRole('button', { name: /Gửi báo cáo/i })
    expect(submitBtn).toBeDisabled()
  })

  it('submits report successfully when reason is picked', async () => {
    vi.mocked(moderationApi.submitUserReport).mockResolvedValue({
      _id: 'report-new',
      reporterId: {} as any,
      targetType: 'story',
      targetId: 'story-123',
      reason: 'spam',
      status: 'pending',
      createdAt: '2026-09-12T10:00:00.000Z',
      updatedAt: '2026-09-12T10:00:00.000Z',
    })

    renderModal(defaultProps)

    const reasonChip = screen.getByText(/Spam hoặc quảng cáo/i)
    fireEvent.click(reasonChip)

    const textarea = screen.getByPlaceholderText(/Mô tả thêm về vi phạm/i)
    fireEvent.change(textarea, { target: { value: 'Chứa liên kết cờ bạc' } })

    const form = screen.getByRole('dialog').querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => {
      expect(moderationApi.submitUserReport).toHaveBeenCalledWith({
        targetType: 'story',
        targetId: 'story-123',
        reason: 'spam',
        description: 'Chứa liên kết cờ bạc',
      })
    })

    expect(await screen.findByText('Báo cáo đã được ghi nhận!')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ ...defaultProps, onClose })

    const closeBtn = screen.getByRole('button', { name: 'Đóng' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('offers reading issues only for chapter reports', () => {
    const view = renderModal(defaultProps)
    expect(screen.queryByRole('button', { name: 'Thiếu nội dung chương' })).not.toBeInTheDocument()
    view.unmount()
    renderModal({ ...defaultProps, targetType: 'chapter' })
    for (const label of ['Lỗi chính tả / dịch thuật', 'Thiếu nội dung chương', 'Nội dung bị lặp', 'Sai chương / sai thứ tự', 'Lỗi hiển thị / định dạng']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Vi phạm bản quyền' })).toBeInTheDocument()
  })

  it('requires a nonempty description for other issues', () => {
    renderModal({ ...defaultProps, targetType: 'chapter' })
    fireEvent.click(screen.getByRole('button', { name: 'Lý do khác' }))
    const submit = screen.getByRole('button', { name: 'Gửi báo cáo' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Vấn đề chưa có trong danh sách' } })
    expect(submit).toBeEnabled()
  })

  it('preserves input after a failure and allows retrying', async () => {
    vi.mocked(moderationApi.submitUserReport)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ _id: 'report-retry' } as Awaited<ReturnType<typeof moderationApi.submitUserReport>>)
    renderModal({ ...defaultProps, targetType: 'chapter' })
    fireEvent.click(screen.getByRole('button', { name: 'Lỗi hiển thị / định dạng' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Đoạn văn bị dính liền' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể gửi báo cáo')
    expect(screen.getByRole('textbox')).toHaveValue('Đoạn văn bị dính liền')
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Báo cáo đã được ghi nhận!')
    expect(moderationApi.submitUserReport).toHaveBeenCalledTimes(2)
  })

  it('prevents duplicate submissions and dismissal while sending', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof moderationApi.submitUserReport>>) => void
    vi.mocked(moderationApi.submitUserReport).mockReturnValue(new Promise(done => { resolve = done }))
    const onClose = vi.fn()
    renderModal({ ...defaultProps, onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Spam hoặc quảng cáo' }))
    const form = screen.getByRole('dialog').querySelector('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đang gửi...' })).toBeDisabled())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(moderationApi.submitUserReport).toHaveBeenCalledTimes(1)
    resolve({ _id: 'report-pending' } as Awaited<ReturnType<typeof moderationApi.submitUserReport>>)
    expect(await screen.findByRole('status')).toHaveTextContent('Báo cáo đã được ghi nhận!')
  })

  it('resets the form after closing and reopening or changing targets', () => {
    const client = mkClient()
    const view = renderModal(defaultProps, client)
    fireEvent.click(screen.getByRole('button', { name: 'Spam hoặc quảng cáo' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nội dung cũ' } })
    view.rerender(<QueryClientProvider client={client}><ReportModal {...defaultProps} isOpen={false} /></QueryClientProvider>)
    view.rerender(<QueryClientProvider client={client}><ReportModal {...defaultProps} /></QueryClientProvider>)
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Gửi báo cáo' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Spam hoặc quảng cáo' }))
    view.rerender(<QueryClientProvider client={client}><ReportModal {...defaultProps} targetId="other-story" /></QueryClientProvider>)
    expect(screen.getByRole('button', { name: 'Gửi báo cáo' })).toBeDisabled()
  })
})
