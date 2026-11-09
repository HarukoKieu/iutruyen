import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { useLogin } from './useAuth'

vi.mock('../api/auth.api', () => ({ loginApi: vi.fn(async () => ({ data: { user: { id: 'author', role: 'author' }, accessToken: 'test-token' } })) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function LoginAction() {
  const login = useLogin()
  return <button onClick={() => login.mutate({ email: 'author@example.org', password: 'test-password' })}>Đăng nhập thử</button>
}
function setup(from?: { pathname: string }) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={[{ pathname: '/login', state: { from } }]}>
      <Routes>
        <Route path="/login" element={<LoginAction />} />
        <Route path="/author/stories" element={<h1>Quản lý truyện</h1>} />
        <Route path="/" element={<h1>Trang chủ</h1>} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>)
}
it('returns to the writing page after login required by its role guard', async () => {
  setup({ pathname: '/author/stories' })
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('heading', { name: 'Quản lý truyện' })).toBeInTheDocument()
})
it.each([undefined, { pathname: '//example.org' }, { pathname: '/login' }])('falls back to home for an absent or unsafe return path: %j', async from => {
  setup(from)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('heading', { name: 'Trang chủ' })).toBeInTheDocument()
})
