import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useNotificationSocket } from './useNotificationSocket'
import { toast } from 'sonner'
vi.mock('sonner', () => ({ toast: vi.fn() }))

const socket = vi.hoisted(() => ({ on: vi.fn(), removeAllListeners: vi.fn() }))
const connection = vi.hoisted(() => ({ connectSocket: vi.fn(), disconnectSocket: vi.fn() }))
vi.mock('@/lib/socket', () => ({ ...connection, getSocket: () => socket }))

afterEach(() => {
  cleanup()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  vi.clearAllMocks()
})

it('reconnects and registers listeners after access token rotation, then disconnects on logout', () => {
  const client = new QueryClient()
  useAuthStore.setState({ isAuthenticated: true, accessToken: 'first-access' })
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter><QueryClientProvider client={client}>{children}</QueryClientProvider></MemoryRouter>
  renderHook(() => useNotificationSocket(), { wrapper })
  expect(connection.connectSocket).toHaveBeenCalledTimes(1)
  const handler = socket.on.mock.calls.find(([event]) => event === 'notification:new')?.[1]
  const notification = { _id: 'n1', title: 'Chương mới', message: 'Chương 100 đã xuất bản', link: '/stories/test/chapters/100' }
  act(() => handler(notification))
  expect(toast).toHaveBeenCalledWith(notification.title, expect.objectContaining({
    description: notification.message,
    action: expect.objectContaining({ label: 'Xem ngay', onClick: expect.any(Function) }),
  }))
  act(() => useAuthStore.getState().setAccessToken('rotated-access'))
  expect(connection.disconnectSocket).toHaveBeenCalledTimes(1)
  expect(connection.connectSocket).toHaveBeenCalledTimes(2)
  expect(socket.on.mock.calls.filter(([event]) => event === 'notification:new')).toHaveLength(2)
  act(() => useAuthStore.setState({ accessToken: null, isAuthenticated: false }))
  expect(socket.removeAllListeners).toHaveBeenCalledTimes(2)
  expect(connection.connectSocket).toHaveBeenCalledTimes(2)
  client.clear()
})
