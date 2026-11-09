import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import NotificationPage from '../NotificationPage'
import { useAuthStore } from '@/features/auth/store/authStore'
import * as notificationsApi from '@/features/notifications/api/notifications.api'
import { createMockNotification } from '@/test/mockData'

vi.mock('@/features/notifications/api/notifications.api')

const mkClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

const renderPage = (client: QueryClient) =>
  render(
    <MemoryRouter initialEntries={['/notifications']}>
      <QueryClientProvider client={client}>
        <NotificationPage />
      </QueryClientProvider>
    </MemoryRouter>
  )

describe('NotificationPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'u-1',
        email: 'test@test.com',
        username: 'test',
        displayName: 'Test User',
        role: 'user',
        isEmailVerified: true,
      },
      accessToken: 'token-abc',
      isAuthenticated: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  })

  it('renders notifications list correctly without throwing', async () => {
    const client = mkClient()
    const notif1 = createMockNotification({ _id: 'n-1', title: 'Thông báo 1' })
    const notif2 = createMockNotification({ _id: 'n-2', title: 'Thông báo 2' })

    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(2)
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      notifications: [notif1, notif2],
      nextCursor: null,
      unreadCount: 2,
    })

    renderPage(client)

    expect(await screen.findByText('Thông báo 1')).toBeInTheDocument()
    expect(screen.getByText('Thông báo 2')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders empty state when there are no notifications', async () => {
    const client = mkClient()
    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(0)
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      notifications: [],
      nextCursor: null,
      unreadCount: 0,
    })

    renderPage(client)

    expect(await screen.findByText('Chưa có thông báo')).toBeInTheDocument()
  })

  it('distinguishes a failed request from an empty list and lets the reader retry', async () => {
    const user = userEvent.setup()
    const client = mkClient()
    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(0)
    vi.mocked(notificationsApi.fetchNotifications)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ notifications: [], nextCursor: null, unreadCount: 0 })

    renderPage(client)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải thông báo')
    expect(screen.queryByText('Chưa có thông báo')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Chưa có thông báo')).toBeInTheDocument()
  })

  it('handles tab switches smoothly', async () => {
    const user = userEvent.setup()
    const client = mkClient()
    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(0)
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      notifications: [],
      nextCursor: null,
      unreadCount: 0,
    })

    renderPage(client)

    const unreadTab = await screen.findByRole('button', { name: /Chưa đọc/i })
    await user.click(unreadTab)

    expect(await screen.findByText('Bạn đã đọc hết rồi!')).toBeInTheDocument()
    expect(unreadTab).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks all as read when button is clicked', async () => {
    const user = userEvent.setup()
    const client = mkClient()
    const notif1 = createMockNotification({ _id: 'n-1', isRead: false })

    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(1)
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      notifications: [notif1],
      nextCursor: null,
      unreadCount: 1,
    })
    vi.mocked(notificationsApi.markAllNotificationsAsRead).mockResolvedValue({ modifiedCount: 1 })

    renderPage(client)

    const markAllBtn = await screen.findByRole('button', { name: /Đánh dấu tất cả đã đọc/i })
    await user.click(markAllBtn)

    await waitFor(() => expect(notificationsApi.markAllNotificationsAsRead).toHaveBeenCalled())
    await waitFor(() => expect(client.isMutating()).toBe(0))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    client.clear()
  })
})
