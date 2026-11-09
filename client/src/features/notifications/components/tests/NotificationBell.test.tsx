import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { NotificationBell } from '../NotificationBell'
import { useAuthStore } from '@/features/auth/store/authStore'
import * as notificationsApi from '@/features/notifications/api/notifications.api'
import { createMockNotification } from '@/test/mockData'

// Mock the API module so tests don't hit the network
vi.mock('@/features/notifications/api/notifications.api')

const mkClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

const renderBell = (client: QueryClient) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <NotificationBell />
      </QueryClientProvider>
    </MemoryRouter>
  )

describe('NotificationBell', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u-1', email: 'test@test.com', username: 'test', displayName: 'Test', role: 'user', isEmailVerified: true },
      accessToken: 'tok',
      isAuthenticated: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  })

  it('should not render when user is unauthenticated', () => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    const client = mkClient()
    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(0)
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      notifications: [],
      nextCursor: null,
      unreadCount: 0,
    })
    const { container } = renderBell(client)
    // Bell button should not be in the document
    expect(container.querySelector('#notification-bell-btn')).toBeNull()
    expect(notificationsApi.fetchNotifications).not.toHaveBeenCalled()
    expect(notificationsApi.fetchUnreadCount).not.toHaveBeenCalled()
  })

  it('should render bell button when authenticated', async () => {
    const client = mkClient()
    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(0)
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      notifications: [],
      nextCursor: null,
      unreadCount: 0,
    })
    renderBell(client)
    expect(screen.getByRole('button', { name: /Thông báo/i })).toBeInTheDocument()
  })

  it('should display badge with unread count when count > 0', async () => {
    const client = mkClient()
    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(3)
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      notifications: [],
      nextCursor: null,
      unreadCount: 3,
    })
    renderBell(client)

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('should open dropdown with notification list when bell is clicked', async () => {
    const user = userEvent.setup()
    const client = mkClient()
    const mockNotif = createMockNotification({ title: 'Chương 10 mới ra!', message: 'Đọc ngay nào' })

    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(1)
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      notifications: [mockNotif],
      nextCursor: null,
      unreadCount: 1,
    })

    renderBell(client)
    const bell = screen.getByRole('button', { name: /Thông báo/i })
    await user.click(bell)

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeInTheDocument()
    })

    expect(screen.getByText('Chương 10 mới ra!')).toBeInTheDocument()
  })

  it('should show "Xem tất cả thông báo" link in panel footer', async () => {
    const user = userEvent.setup()
    const client = mkClient()

    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(0)
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      notifications: [],
      nextCursor: null,
      unreadCount: 0,
    })

    renderBell(client)
    await user.click(screen.getByRole('button', { name: /Thông báo/i }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Xem tất cả thông báo/i })).toBeInTheDocument()
    })
  })

  it('should close dropdown when Escape is pressed', async () => {
    const user = userEvent.setup()
    const client = mkClient()

    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(0)
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      notifications: [],
      nextCursor: null,
      unreadCount: 0,
    })

    renderBell(client)
    const trigger = screen.getByRole('button', { name: /Thông báo/i })
    await user.click(trigger)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Đóng' })).toHaveFocus()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
  })

  it('dismisses when keyboard focus leaves the disclosure', async () => {
    const user = userEvent.setup()
    const client = mkClient()
    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue(0)
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({ notifications: [], nextCursor: null, unreadCount: 0 })
    render(<MemoryRouter><QueryClientProvider client={client}><NotificationBell /><button type="button">Tiếp theo</button></QueryClientProvider></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: /Thông báo/i }))
    expect(screen.getByRole('button', { name: 'Đóng' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: /Xem tất cả thông báo/i })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Tiếp theo' })).toHaveFocus()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
