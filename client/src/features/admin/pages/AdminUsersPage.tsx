import { useState } from 'react'
import {
  Users,
  PenTool,
  ShieldCheck,
  Search,
  AlertTriangle,
  User as UserIcon,
  CheckCircle2,
  Ban,
} from 'lucide-react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { adminApi } from '../api/admin.api'
import { useAdminQuery, adminError } from '../hooks/useAdmin'
import AdminActionDialog from '../components/AdminActionDialog'
import AdminPagination from '../components/AdminPagination'
import type { AdminUser, AdminAction } from '../types'

const roleBadges: Record<
  AdminUser['role'],
  { label: string; className: string }
> = {
  admin: {
    label: 'Admin',
    className: 'bg-primary/10 text-link dark:text-sky-300 border-primary/30',
  },
  moderator: {
    label: 'Moderator',
    className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  },
  author: {
    label: 'Tác giả',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  user: {
    label: 'Độc giả',
    className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
  },
}

const authorStatusBadges: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: 'TG Chờ duyệt',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  approved: {
    label: 'TG Đã duyệt',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  revoked: {
    label: 'TG Đã thu hồi',
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
  },
}

export default function AdminUsersPage({
  mode = 'users',
}: {
  mode?: 'users' | 'authors' | 'moderators'
}) {
  const actor = useAuthStore(state => state.user)
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState(mode === 'moderators' ? 'moderator' : '')
  const [authorStatus, setAuthorStatus] = useState(mode === 'authors' ? 'pending' : '')
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [action, setAction] = useState<{ user: AdminUser; type: AdminAction } | null>(null)

  const params = {
    q: q || undefined,
    status: status || undefined,
    role: role || undefined,
    authorStatus: authorStatus || undefined,
    cursor: cursors.at(-1),
    limit: 20,
  }

  const query = useAdminQuery('users', params, signal => adminApi.users(params, signal))
  const canStepUp = actor?.provider === undefined || actor.provider === 'local'
  const reset = () => setCursors([undefined])

  const pageTitle =
    mode === 'authors'
      ? 'Đơn đăng ký và quyền tác giả'
      : mode === 'moderators'
      ? 'Kiểm duyệt viên'
      : 'Người dùng'

  const HeaderIcon =
    mode === 'authors' ? PenTool : mode === 'moderators' ? ShieldCheck : Users

  return (
    <section className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-link border border-border">
            <HeaderIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-serif">
              {pageTitle}
            </h2>
            <p className="text-xs text-muted-foreground">
              Tra cứu thông tin, phân quyền và kiểm soát bảo mật tài khoản
            </p>
          </div>
        </div>

        {query.data?.data && (
          <Badge variant="outline" className="self-start sm:self-auto text-xs px-2.5 py-1 font-mono">
            Hiển thị {query.data.data.length} tài khoản
          </Badge>
        )}
      </div>

      {/* OAuth Step-up Warning Notice */}
      {!canStepUp && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p>
            Tài khoản OAuth chưa có luồng xác thực lại được nghiệm thu; thao tác quyền/khóa tạm vô hiệu hóa.
          </p>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <form
          onSubmit={event => {
            event.preventDefault()
            setQ(draft.trim())
            reset()
          }}
          className="admin-filters flex flex-wrap items-end gap-3"
        >
          <label className="flex-1 min-w-[200px] text-xs sm:text-sm font-medium space-y-1.5">
            <span>Tìm đầu username/email</span>
            <div className="relative">
              <input
                maxLength={100}
                placeholder="Nhập tên đăng nhập hoặc email…"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </label>

          <label className="w-full sm:w-auto min-w-[130px] text-xs sm:text-sm font-medium space-y-1.5">
            <span>Quyền</span>
            <select
              value={role}
              onChange={event => {
                setRole(event.target.value)
                reset()
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Tất cả</option>
              {['user', 'author', 'moderator', 'admin'].map(value => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="w-full sm:w-auto min-w-[130px] text-xs sm:text-sm font-medium space-y-1.5">
            <span>Tài khoản</span>
            <select
              value={status}
              onChange={event => {
                setStatus(event.target.value)
                reset()
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Tất cả</option>
              <option value="active">Hoạt động</option>
              <option value="locked">Bị khóa</option>
            </select>
          </label>

          <label className="w-full sm:w-auto min-w-[130px] text-xs sm:text-sm font-medium space-y-1.5">
            <span>Tác giả</span>
            <select
              value={authorStatus}
              onChange={event => {
                setAuthorStatus(event.target.value)
                reset()
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Tất cả</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="revoked">Đã thu hồi</option>
            </select>
          </label>

          <Button type="submit" className="rounded-lg px-5 py-2 font-medium shrink-0 flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>Tìm</span>
          </Button>
        </form>
      </div>

      {/* Query Status / Table Area */}
      {query.isPending ? (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-xs">
          <div aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Đang tải tài khoản…</span>
        </div>
      ) : query.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive shadow-xs">
          <p className="font-semibold mb-1">Lỗi tải danh sách tài khoản</p>
          <p>{adminError(query.error)}</p>
        </div>
      ) : (
        <>
          {query.data.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-xs">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-base font-semibold text-foreground">Không có tài khoản phù hợp.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Thử thay đổi bộ lọc tìm kiếm hoặc từ khóa tra cứu
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table role="table" className="admin-data-table w-full text-left text-sm">
                  <caption className="sr-only">Danh sách tài khoản, mỗi trang tối đa 20</caption>
                  <thead className="bg-surface-raised border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    <tr>
                      {['Tài khoản', 'Quyền', 'Trạng thái', 'Thao tác'].map(label => (
                        <th key={label} scope="col" className="p-3.5">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {query.data.data.map(user => {
                      const roleConfig = roleBadges[user.role] || {
                        label: user.role,
                        className: 'bg-muted text-foreground',
                      }
                      const authorConfig = user.authorStatus ? authorStatusBadges[user.authorStatus] : null

                      return (
                        <tr key={user.id} className="transition-colors hover:bg-surface-hover/50">
                          {/* User Account Info */}
                          <td data-label="Tài khoản" className="p-3.5 align-top">
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-raised font-bold text-xs text-foreground border border-border">
                                {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : <UserIcon className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground leading-tight">
                                  {user.displayName}
                                </div>
                                <div className="text-xs font-mono text-muted-foreground mt-0.5">
                                  @{user.username}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Roles & Author status */}
                          <td data-label="Quyền" className="p-3.5 align-top">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border ${roleConfig.className}`}>
                                {user.role}
                              </span>
                              {user.authorStatus && (
                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${authorConfig?.className || 'border-border bg-surface-raised'}`}>
                                  {user.authorStatus}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Account status */}
                          <td data-label="Trạng thái" className="p-3.5 align-top">
                            <div>
                              {user.isLocked ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                                    <Ban className="h-3 w-3" />
                                    {user.lockKind === 'suspend'
                                      ? `Đình chỉ đến ${new Date(user.suspendedUntil!).toLocaleString('vi-VN')}`
                                      : 'Bị ban'}
                                  </span>
                                  {user.lockedReason && (
                                    <p className="text-xs text-muted-foreground italic break-words max-w-xs">
                                      {user.lockedReason}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Hoạt động
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td data-label="Thao tác" className="p-3.5 align-top">
                            <div className="flex flex-wrap items-center gap-2">
                              {user.id === actor?.id ? (
                                <span className="rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                  Tài khoản của bạn
                                </span>
                              ) : (
                                (['role', 'author-status', ...(user.isLocked ? ['unban'] : ['suspend', 'ban'])] as AdminAction[]).map(type => {
                                  const actionLabels: Record<AdminAction, string> = {
                                    role: 'Đổi quyền',
                                    'author-status': 'Quyền tác giả',
                                    unban: 'Mở khóa',
                                    suspend: 'Đình chỉ',
                                    ban: 'Ban',
                                  }

                                  const isBan = type === 'ban'
                                  const isSuspend = type === 'suspend'
                                  const isUnban = type === 'unban'

                                  return (
                                    <Button
                                      key={type}
                                      size="sm"
                                      variant={isBan ? 'destructive' : 'outline'}
                                      disabled={!canStepUp}
                                      onClick={() => setAction({ user, type })}
                                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                                        isSuspend
                                          ? 'border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300'
                                          : isUnban
                                          ? 'border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300'
                                          : ''
                                      }`}
                                    >
                                      {actionLabels[type]}
                                    </Button>
                                  )
                                })
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          <div className="pt-2">
            <AdminPagination
              hasPrevious={cursors.length > 1}
              hasMore={query.data.meta.hasMore}
              pending={query.isFetching}
              onPrevious={() => setCursors(values => values.slice(0, -1))}
              onNext={() => {
                const next = query.data.meta.nextCursor
                if (next) setCursors(values => [...values, next])
              }}
            />
          </div>
        </>
      )}

      {action && (
        <AdminActionDialog
          user={action.user}
          action={action.type}
          onClose={() => setAction(null)}
        />
      )}
    </section>
  )
}

