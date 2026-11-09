import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useLogout } from './useAuth'
import { logoutApi } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'
import type { User } from '@/types/user'

vi.mock('../api/auth.api', () => ({ logoutApi: vi.fn() }))
vi.mock('next-themes', () => ({ useTheme: () => ({ setTheme: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function LogoutAction() {
  const logout = useLogout()
  const location = useLocation()
  const authenticated = useAuthStore(state => state.isAuthenticated)
  return <>
    <button onClick={() => logout.mutate()}>Đăng xuất</button>
    <output aria-label="Đường dẫn">{location.pathname}{location.search}{location.hash}</output>
    <output aria-label="Phiên đăng nhập">{authenticated ? 'Đã đăng nhập' : 'Khách'}</output>
  </>
}

describe('Logout stays on the current public page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: { id: 'reader-1', role: 'user' } as User, accessToken: 'token', isAuthenticated: true })
  })
  afterEach(() => {
    cleanup()
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  })

  it.each(['success', 'failure'])('clears the session without changing the URL on API %s', async outcome => {
    if (outcome === 'success') vi.mocked(logoutApi).mockResolvedValueOnce({ success: true, data: null })
    else vi.mocked(logoutApi).mockRejectedValueOnce(new Error('Network unavailable'))
    const path = '/stories/tru-tien/chapters/chuong-1?mode=read#comments'
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><LogoutAction /></MemoryRouter></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    await waitFor(() => expect(screen.getByLabelText('Phiên đăng nhập')).toHaveTextContent('Khách'))
    expect(screen.getByLabelText('Đường dẫn')).toHaveTextContent(path)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
