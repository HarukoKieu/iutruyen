import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import AdminChart from '../components/AdminChart'
import AdminOverviewPage from '../pages/AdminOverviewPage'
import AdminUsersPage from '../pages/AdminUsersPage'
import AdminActionDialog from '../components/AdminActionDialog'
import AdminBackupsPage from '../pages/AdminBackupsPage'
import { adminApi } from '../api/admin.api'
import { useAuthStore } from '@/features/auth/store/authStore'
import { queryClient } from '@/lib/queryClient'
import { RequireRole } from '@/components/common/RequireRole'
import type { AdminUser } from '../types'

vi.mock('../api/admin.api', () => ({ adminApi: { overview: vi.fn(), charts: vi.fn(), users: vi.fn(), act: vi.fn(), backups: vi.fn(), enqueueBackup: vi.fn() } }))
const actor = { id: 'actor', username: 'admin', displayName: 'Admin', email: 'admin@example.test', role: 'admin' as const, isEmailVerified: true }
const user: AdminUser = { ...actor, id: 'target', username: 'reader', role: 'user', provider: 'local', isLocked: false, adminVersion: 4, createdAt: '2026-10-12T00:00:00Z' }
function wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider> }
beforeEach(() => {
  vi.resetAllMocks(); queryClient.clear()
  useAuthStore.setState({ user: actor, isAuthenticated: true, accessToken: 'TOKEN', hasHydrated: true })
  vi.mocked(adminApi.charts).mockResolvedValue({ metric: 'users', timezone: 'UTC', semantics: 'created records', points: [{ date: '2026-10-12', value: 7 }] })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } })
})
describe('admin UI production contracts', () => {
  it('charts preserve unknown gaps instead of inventing zero readings', () => {
    render(<AdminChart chart={{ metric: 'views', timezone: 'UTC', semantics: '', points: [{ date: '2026-10-11', value: null }, { date: '2026-10-12', value: 0 }, { date: '2026-10-13', value: 12 }] }} />)
    expect(screen.getByText('Chưa có mẫu')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByRole('img').querySelectorAll('rect')).toHaveLength(2)
    expect(screen.getByText(/Không phải lượt đọc\/ngày/)).toBeInTheDocument()
  })
  it('overview renders API values and real dependency timestamps', async () => {
    vi.mocked(adminApi.overview).mockResolvedValue({ asOf: '2026-10-12T00:00:00Z', kpis: { users: 81, authors: 7, stories: 19, publicChapters: 103, pendingStories: 2, pendingChapters: 5, openReports: 4 }, topStories: [], health: { checkedAt: '2026-10-12T00:01:00Z', mongodb: 'available', redis: 'unavailable' } })
    render(<AdminOverviewPage />, { wrapper })
    expect(await screen.findByText('81')).toBeInTheDocument()
    expect(screen.getByText('103')).toBeInTheDocument()
    expect(screen.getByText(/Redis: unavailable/)).toBeInTheDocument()
    expect(screen.getByText('Chưa có truyện được duyệt.')).toBeInTheDocument()
  })
  it('query error never falls back to successful fake counts', async () => {
    vi.mocked(adminApi.overview).mockRejectedValue({ response: { data: { message: 'Không có quyền hiện tại' } } })
    render(<AdminOverviewPage />, { wrapper })
    expect(await screen.findByRole('alert')).toHaveTextContent('Không có quyền hiện tại')
    expect(screen.queryByText('Tài khoản đăng ký')).not.toBeInTheDocument()
  })
  it('users paginate with cursor and search resets cursor rather than filtering a partial page locally', async () => {
    vi.mocked(adminApi.users).mockResolvedValue({ data: [user], meta: { limit: 20, hasMore: true, nextCursor: 'NEXT' } })
    render(<AdminUsersPage />, { wrapper })
    expect(await screen.findByText(/@reader/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() => expect(adminApi.users).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'NEXT', limit: 20 }), expect.any(AbortSignal)))
    fireEvent.change(screen.getByLabelText('Tìm đầu username/email'), { target: { value: 'reader' } }); fireEvent.click(screen.getByRole('button', { name: 'Tìm' }))
    await waitFor(() => expect(adminApi.users).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined, q: 'reader' }), expect.any(AbortSignal)))
  })
  it('authors initially query pending applications, including reader-role applicants', async () => {
    vi.mocked(adminApi.users).mockResolvedValue({ data: [], meta: { limit: 20, hasMore: false, nextCursor: null } })
    render(<AdminUsersPage mode="authors" />, { wrapper })
    expect(await screen.findByText('Không có tài khoản phù hợp.')).toBeInTheDocument()
    expect(adminApi.users).toHaveBeenCalledWith(expect.objectContaining({ authorStatus: 'pending', role: undefined }), expect.any(AbortSignal))
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled()
  })
  it('no controls to mutate the current admin account', async () => {
    vi.mocked(adminApi.users).mockResolvedValue({ data: [{ ...user, id: actor.id }], meta: { limit: 20, hasMore: false, nextCursor: null } })
    render(<AdminUsersPage />, { wrapper })
    expect(await screen.findByText('Tài khoản của bạn')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ban' })).not.toBeInTheDocument()
  })
  it('OAuth-only admins see disabled privilege controls with an explicit explanation', async () => {
    useAuthStore.setState({ user: { ...actor, provider: 'google' } })
    vi.mocked(adminApi.users).mockResolvedValue({ data: [user], meta: { limit: 20, hasMore: false, nextCursor: null } })
    render(<AdminUsersPage />, { wrapper })
    expect(await screen.findByRole('button', { name: 'Ban' })).toBeDisabled()
    expect(screen.getByText(/OAuth chưa có luồng xác thực lại/)).toBeInTheDocument()
  })
  it('danger dialog sends versioned payload and clears password after an error', async () => {
    vi.mocked(adminApi.act).mockRejectedValue({ response: { data: { message: 'Phiên bản đã thay đổi' } } })
    render(<AdminActionDialog user={user} action="suspend" onClose={vi.fn()} />, { wrapper })
    fireEvent.change(screen.getByLabelText('Lý do (10–500 ký tự)'), { target: { value: 'Kiểm thử đình chỉ tài khoản' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu của admin để xác minh lại'), { target: { value: 'FRESH_PASSWORD' } })
    fireEvent.change(screen.getByLabelText('Số ngày (1–30)'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh và thực hiện' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Phiên bản đã thay đổi')
    expect(adminApi.act).toHaveBeenCalledWith('target', 'suspend', { expectedVersion: 4, reason: 'Kiểm thử đình chỉ tài khoản', days: 3 }, 'FRESH_PASSWORD')
    expect(screen.getByLabelText('Mật khẩu của admin để xác minh lại')).toHaveValue('')
  })
  it('backup explicitly reports missing adapter and offers no fake success action', async () => {
    vi.mocked(adminApi.backups).mockResolvedValue({ status: 'NOT_CONFIGURED', reason: 'Chờ storage/runtime', items: [] })
    render(<AdminBackupsPage />, { wrapper })
    expect(await screen.findByText('Trạng thái: Chưa cấu hình')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('role guard waits for hydration and prevents non-admin rendering', () => {
    useAuthStore.setState({ hasHydrated: false })
    const view = render(<RequireRole roles={['admin']}>PRIVATE_ADMIN</RequireRole>, { wrapper })
    expect(screen.getByRole('status')).toHaveTextContent('khôi phục phiên')
    expect(screen.queryByText('PRIVATE_ADMIN')).not.toBeInTheDocument()
    useAuthStore.setState({ hasHydrated: true, user: { ...actor, role: 'user' } })
    view.rerender(<RequireRole roles={['admin']}>PRIVATE_ADMIN</RequireRole>)
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('backup requires a reason and consistency acknowledgment, then reports queued rather than completed', async () => {
    vi.mocked(adminApi.backups).mockResolvedValue({ status: 'READY', reason: 'Local logical backup', items: [] })
    vi.mocked(adminApi.enqueueBackup).mockResolvedValue({ id: 'job', actorId: actor.id, status: 'queued', consistency: 'logical_non_snapshot', createdAt: new Date().toISOString() })
    render(<AdminBackupsPage />, { wrapper })
    const button = await screen.findByRole('button', { name: 'Đưa backup vào hàng đợi' })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Lý do backup (10–500 ký tự)'), { target: { value: 'Kiểm thử backup local' } })
    expect(button).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(button)
    expect(await screen.findByText('Đã tiếp nhận yêu cầu backup. Theo dõi kết quả trong lịch sử.')).toBeInTheDocument()
    expect(adminApi.enqueueBackup).toHaveBeenCalledTimes(1)
    expect(adminApi.enqueueBackup).toHaveBeenCalledWith('Kiểm thử backup local', expect.anything())
    expect(screen.getByLabelText('Lý do backup (10–500 ký tự)')).toHaveValue('')
  })
  it('backup failure history stays visible when runtime is unavailable and never enables enqueue', async () => {
    vi.mocked(adminApi.backups).mockResolvedValue({ status: 'UNAVAILABLE', reason: 'Tools unavailable', items: [{ id: 'job', actorId: actor.id, status: 'failed', consistency: 'logical_non_snapshot', createdAt: new Date().toISOString(), errorCode: 'BACKUP_TIMEOUT' }] })
    render(<AdminBackupsPage />, { wrapper })
    expect(await screen.findByText('BACKUP_TIMEOUT')).toBeInTheDocument()
    expect(screen.getByText('Thất bại')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đưa backup vào hàng đợi' })).not.toBeInTheDocument()
  })
  it('role change clears private admin data for the same user', () => {
    queryClient.setQueryData(['admin', actor.id, 'users', {}], { credential: 'private' })
    queryClient.setQueryData(['stories', 'list'], ['public'])
    useAuthStore.getState().setUser({ ...actor, role: 'user' })
    expect(queryClient.getQueryData(['admin', actor.id, 'users', {}])).toBeUndefined()
    expect(queryClient.getQueryData(['stories', 'list'])).toEqual(['public'])
  })
})
