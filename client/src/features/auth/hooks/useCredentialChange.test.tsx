import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useChangePassword } from './useUser'
import { changePasswordApi } from '../api/users.api'
import { useAuthStore } from '../store/authStore'
import type { User } from '@/types/user'
vi.mock('../api/users.api', () => ({ changePasswordApi: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
function Action() {
  const change = useChangePassword(), location = useLocation()
  return <><button onClick={() => change.mutate({ oldPassword: 'old', newPassword: 'new' })}>Đổi mật khẩu</button><output>{location.pathname}</output></>
}
beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: { id: 'user' } as User, accessToken: 'old-token', isAuthenticated: true }) })
afterEach(cleanup)
it('clears private state and returns to login only after the server commits the password change', async () => {
  vi.mocked(changePasswordApi).mockResolvedValue({ success: true, data: null })
  const cache = new QueryClient(); cache.setQueryData(['private'], 'secret')
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={['/profile']}><Action /></MemoryRouter></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('/login'))
  expect(useAuthStore.getState().accessToken).toBeNull()
  expect(cache.getQueryData(['private'])).toBeUndefined()
})
