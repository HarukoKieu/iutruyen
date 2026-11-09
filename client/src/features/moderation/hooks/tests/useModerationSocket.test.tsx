import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useModerationSocket } from '../useModerationSocket'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

const socket = vi.hoisted(() => ({
  on: vi.fn(),
  off: vi.fn(),
}))
vi.mock('@/lib/socket', () => ({ getSocket: () => socket }))

afterEach(() => {
  cleanup()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  vi.clearAllMocks()
})

it('does not register listeners if user is regular user', () => {
  const client = new QueryClient()
  useAuthStore.setState({
    isAuthenticated: true,
    accessToken: 'test-token',
    user: { id: 'u1', role: 'user', displayName: 'Reader' } as any,
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  )

  renderHook(() => useModerationSocket(), { wrapper })
  expect(socket.on).not.toHaveBeenCalled()
  client.clear()
})

it('registers listeners and displays toast when new report event arrives for moderator', () => {
  const client = new QueryClient()
  useAuthStore.setState({
    isAuthenticated: true,
    accessToken: 'mod-token',
    user: { id: 'm1', role: 'moderator', displayName: 'Mod' } as any,
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  )

  renderHook(() => useModerationSocket(), { wrapper })
  expect(socket.on).toHaveBeenCalledWith('moderation:new_report', expect.any(Function))

  const reportHandler = socket.on.mock.calls.find(([event]) => event === 'moderation:new_report')?.[1]
  act(() => {
    reportHandler({ reportId: 'r1', reason: 'Nội dung phản cảm' })
  })

  expect(toast.warning).toHaveBeenCalledWith(
    'Báo cáo nội dung mới',
    expect.objectContaining({
      description: expect.stringContaining('Nội dung phản cảm'),
    })
  )

  client.clear()
})

