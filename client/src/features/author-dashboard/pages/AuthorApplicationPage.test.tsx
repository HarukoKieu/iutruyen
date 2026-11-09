import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/store/authStore'
import type { User } from '@/types/user'
import AuthorApplicationPage from './AuthorApplicationPage'

const mutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null as unknown,
}))
const currentUser = vi.hoisted(() => ({ refetch: vi.fn(), isFetching: false, isError: false }))

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/features/auth/hooks/useUser', () => ({ useBecomeAuthor: () => mutation }))
vi.mock('@/features/auth/hooks/useAuth', () => ({ useCurrentUser: () => currentUser }))

const reader: User = {
  id: 'reader-1',
  username: 'nguoi_viet',
  email: 'writer@example.com',
  displayName: 'Người viết',
  bio: 'Yêu thích truyện phiêu lưu.',
  role: 'user',
  isEmailVerified: true,
}

function LoginDestination() {
  const location = useLocation()
  return <output aria-label="Trang quay lại">{location.state?.from?.pathname}</output>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/author/apply']}>
      <Routes>
        <Route path="/author/apply" element={<AuthorApplicationPage />} />
        <Route path="/login" element={<LoginDestination />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mutation, { isPending: false, isSuccess: false, isError: false, error: null })
  Object.assign(currentUser, { isFetching: false, isError: false })
  useAuthStore.setState({ user: { ...reader }, isAuthenticated: true, hasHydrated: true })
})

describe('author application', () => {
  it('prefills existing public profile data and keeps the account email read-only', () => {
    renderPage()

    expect(screen.getByLabelText('Bút danh / tên hiển thị', { exact: false })).toHaveValue(reader.displayName)
    expect(screen.getByLabelText('Bút danh / tên hiển thị', { exact: false })).toHaveAttribute('maxlength', '50')
    expect(screen.getByLabelText('Giới thiệu bản thân', { exact: false })).toHaveValue(reader.bio)
    expect(screen.getByLabelText('Giới thiệu bản thân', { exact: false })).toHaveAttribute('maxlength', '500')
    expect(screen.getByDisplayValue(reader.email)).toHaveAttribute('readonly')
  })

  it('requires the content commitment before sending an application', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Gửi đơn đăng ký' }))

    expect(mutation.mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox', { name: /Tôi cam kết/ })).toBeRequired()
  })

  it('rejects a pen name containing only whitespace', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.clear(screen.getByLabelText('Bút danh / tên hiển thị', { exact: false }))
    await user.type(screen.getByLabelText('Bút danh / tên hiển thị', { exact: false }), '   ')
    await user.click(screen.getByRole('checkbox', { name: /Tôi cam kết/ }))
    await user.click(screen.getByRole('button', { name: 'Gửi đơn đăng ký' }))

    expect(mutation.mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('sends the trimmed public profile after the reader confirms the commitment', async () => {
    const user = userEvent.setup()
    renderPage()
    fireEvent.change(screen.getByLabelText('Bút danh / tên hiển thị', { exact: false }), { target: { value: '  Mây Xanh  ' } })
    fireEvent.change(screen.getByLabelText('Giới thiệu bản thân', { exact: false }), { target: { value: '  Viết những hành trình mới.  ' } })
    await user.click(screen.getByRole('checkbox', { name: /Tôi cam kết/ }))
    await user.click(screen.getByRole('button', { name: 'Gửi đơn đăng ký' }))

    expect(mutation.mutate).toHaveBeenCalledTimes(1)
    expect(mutation.mutate.mock.calls[0]?.[0]).toEqual({ displayName: 'Mây Xanh', bio: 'Viết những hành trình mới.' })
  })

  it('allows an empty introduction', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.clear(screen.getByLabelText('Giới thiệu bản thân', { exact: false }))
    await user.click(screen.getByRole('checkbox', { name: /Tôi cam kết/ }))
    await user.click(screen.getByRole('button', { name: 'Gửi đơn đăng ký' }))

    expect(mutation.mutate.mock.calls[0]?.[0]).toEqual({ displayName: reader.displayName, bio: '' })
  })

  it('prevents another submit while the request is in progress', () => {
    mutation.isPending = true
    renderPage()

    expect(screen.getByRole('button', { name: /Gửi đơn đăng ký|Đang gửi/ })).toBeDisabled()
  })

  it('shows the server failure while preserving the entered profile', () => {
    mutation.isError = true
    mutation.error = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { message: 'Không thể gửi đơn lúc này.' } },
    })
    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('Không thể gửi đơn lúc này.')
    expect(screen.getByLabelText('Bút danh / tên hiển thị', { exact: false })).toHaveValue(reader.displayName)
    expect(screen.getByLabelText('Giới thiệu bản thân', { exact: false })).toHaveValue(reader.bio)
  })

  it('shows the pending application instead of a duplicate application form', () => {
    useAuthStore.setState({ user: { ...reader, authorStatus: 'pending' } })
    renderPage()

    expect(screen.getByRole('heading', { name: 'Đơn đăng ký đang chờ duyệt' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gửi đơn đăng ký' })).not.toBeInTheDocument()
  })

  it('lets the reader refresh approval status while waiting for review', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: { ...reader, authorStatus: 'pending' } })
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Cập nhật trạng thái' }))

    expect(currentUser.refetch).toHaveBeenCalledTimes(1)
  })

  it('disables the status refresh while a request is running', () => {
    currentUser.isFetching = true
    useAuthStore.setState({ user: { ...reader, authorStatus: 'pending' } })
    renderPage()

    expect(screen.getByRole('button', { name: /Cập nhật trạng thái|Đang cập nhật/ })).toBeDisabled()
  })

  it('reports a failed status refresh without offering a duplicate application', () => {
    currentUser.isError = true
    useAuthStore.setState({ user: { ...reader, authorStatus: 'pending' } })
    renderPage()

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gửi đơn đăng ký' })).not.toBeInTheDocument()
  })

  it.each(['author', 'admin'] as const)('offers the author dashboard to an existing %s', (role) => {
    useAuthStore.setState({ user: { ...reader, role, authorStatus: 'approved' } })
    renderPage()

    expect(screen.getAllByRole('link').some(link => link.getAttribute('href') === '/author/stories')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Gửi đơn đăng ký' })).not.toBeInTheDocument()
  })

  it('allows a reader with revoked author rights to submit a new application', () => {
    useAuthStore.setState({ user: { ...reader, authorStatus: 'revoked' } })
    renderPage()

    expect(screen.getByRole('button', { name: 'Gửi đơn đăng ký' })).toBeInTheDocument()
  })

  it('does not offer a moderator an action that would change their role', () => {
    useAuthStore.setState({ user: { ...reader, role: 'moderator' } })
    renderPage()

    expect(screen.queryByRole('button', { name: 'Gửi đơn đăng ký' })).not.toBeInTheDocument()
  })

  it('waits for the saved authentication state before displaying the form', () => {
    useAuthStore.setState({ hasHydrated: false })
    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gửi đơn đăng ký' })).not.toBeInTheDocument()
  })

  it('preserves the application destination when a guest signs in', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: null, isAuthenticated: false })
    renderPage()
    await user.click(screen.getByRole('link', { name: /Đăng nhập/ }))

    expect(screen.getByLabelText('Trang quay lại')).toHaveTextContent('/author/apply')
  })
})
