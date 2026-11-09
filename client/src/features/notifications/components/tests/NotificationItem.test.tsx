import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { NotificationItem } from '../NotificationItem'
import { createMockNotification } from '@/test/mockData'
import * as notificationsApi from '@/features/notifications/api/notifications.api'

vi.mock('@/features/notifications/api/notifications.api')

const mkClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

const renderItem = (client: QueryClient, ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>
  )

describe('NotificationItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(notificationsApi.markNotificationAsRead).mockResolvedValue(
      createMockNotification({ isRead: true })
    )
    vi.mocked(notificationsApi.deleteNotification).mockResolvedValue(undefined)
  })

  it('should render notification title and message', () => {
    const n = createMockNotification({
      title: 'Chương 5 mới!',
      message: 'Truyện bạn theo dõi vừa ra chương 5.',
    })
    renderItem(mkClient(), <NotificationItem notification={n} />)

    expect(screen.getByText('Chương 5 mới!')).toBeInTheDocument()
    expect(screen.getByText('Truyện bạn theo dõi vừa ra chương 5.')).toBeInTheDocument()
  })

  it('should show blue BookOpen icon for new_chapter type', () => {
    const n = createMockNotification({ type: 'new_chapter' })
    const { container } = renderItem(mkClient(), <NotificationItem notification={n} />)
    // Icon wrapper uses bg-blue-500/10 class
    expect(container.querySelector('.bg-blue-500\\/10')).toBeInTheDocument()
  })

  it('should show purple MessageSquare icon for comment_reply type', () => {
    const n = createMockNotification({ type: 'comment_reply' })
    const { container } = renderItem(mkClient(), <NotificationItem notification={n} />)
    expect(container.querySelector('.bg-violet-500\\/10')).toBeInTheDocument()
  })

  it('should show rose Heart icon for comment_like type', () => {
    const n = createMockNotification({ type: 'comment_like' })
    const { container } = renderItem(mkClient(), <NotificationItem notification={n} />)
    expect(container.querySelector('.bg-rose-500\\/10')).toBeInTheDocument()
  })

  it('should show green UserPlus icon for new_follow type', () => {
    const n = createMockNotification({ type: 'new_follow' })
    const { container } = renderItem(mkClient(), <NotificationItem notification={n} />)
    expect(container.querySelector('.bg-emerald-500\\/10')).toBeInTheDocument()
  })

  it('should show unread dot when isRead is false', () => {
    const n = createMockNotification({ isRead: false })
    const { container } = renderItem(mkClient(), <NotificationItem notification={n} />)
    // Unread dot: rounded-full bg-primary h-2 w-2
    const dot = container.querySelector('.rounded-full.bg-primary.h-2.w-2')
    expect(dot).toBeInTheDocument()
  })

  it('should not show unread dot when isRead is true', () => {
    const n = createMockNotification({ isRead: true })
    const { container } = renderItem(mkClient(), <NotificationItem notification={n} />)
    const dot = container.querySelector('.rounded-full.bg-primary.h-2.w-2')
    expect(dot).toBeNull()
  })

  it('should call markAsRead when unread item is clicked', async () => {
    const user = userEvent.setup()
    const n = createMockNotification({ isRead: false })
    renderItem(mkClient(), <NotificationItem notification={n} />)

    // Click the notification item itself (role=button with aria-label = notification title)
    await user.click(screen.getByRole('button', { name: n.title }))
    // Check first arg of first call (React Query passes mutation context as second arg)
    expect(vi.mocked(notificationsApi.markNotificationAsRead).mock.calls[0][0]).toBe(n._id)
  })

  it('supports Space activation and keeps delete independent from opening a notification', async () => {
    const user = userEvent.setup()
    const n = createMockNotification({ isRead: false })
    renderItem(mkClient(), <NotificationItem notification={n} />)

    const openButton = screen.getByRole('button', { name: n.title })
    openButton.focus()
    await user.keyboard(' ')
    expect(vi.mocked(notificationsApi.markNotificationAsRead).mock.calls[0][0]).toBe(n._id)
    expect(openButton).toHaveAccessibleDescription(`${n.message} Chưa đọc`)

    vi.mocked(notificationsApi.markNotificationAsRead).mockClear()
    const deleteButton = screen.getByRole('button', { name: 'Xóa thông báo' })
    expect(openButton).not.toContainElement(deleteButton)
    await user.click(deleteButton)
    expect(vi.mocked(notificationsApi.deleteNotification).mock.calls[0][0]).toBe(n._id)
    expect(notificationsApi.markNotificationAsRead).not.toHaveBeenCalled()
  })

  it('should not show delete button in compact mode', () => {
    const n = createMockNotification()
    renderItem(mkClient(), <NotificationItem notification={n} compact />)
    expect(screen.queryByLabelText('Xóa thông báo')).toBeNull()
  })

  it('should show delete button in non-compact mode', () => {
    const n = createMockNotification()
    renderItem(mkClient(), <NotificationItem notification={n} />)
    expect(screen.getByLabelText('Xóa thông báo')).toBeInTheDocument()
  })
})
