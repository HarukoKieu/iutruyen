import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdminAction, adminError } from '../hooks/useAdmin'
import type { AdminAction, AdminUser, ActionPayload } from '../types'
import { useAdminDialog } from '../hooks/useAdminDialog'

const labels: Record<AdminAction, string> = {
  ban: 'Ban vĩnh viễn',
  unban: 'Mở khóa',
  suspend: 'Đình chỉ có thời hạn',
  role: 'Đổi quyền',
  'author-status': 'Duyệt / thu hồi tác giả',
}

export default function AdminActionDialog({
  user,
  action,
  onClose,
}: {
  user: AdminUser
  action: AdminAction
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [days, setDays] = useState(1)
  const [role, setRole] = useState<AdminUser['role']>('user')
  const [status, setStatus] = useState<'approved' | 'revoked'>(
    user.authorStatus === 'approved' ? 'revoked' : 'approved'
  )
  const [error, setError] = useState('')
  const mutation = useAdminAction()

  useAdminDialog(dialog)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const payload: ActionPayload = {
      expectedVersion: user.adminVersion,
      reason: reason.trim(),
      ...(action === 'suspend' ? { days } : {}),
      ...(action === 'role' ? { role } : {}),
      ...(action === 'author-status' ? { status } : {}),
    }

    try {
      await mutation.mutateAsync({ id: user.id, action, payload, password })
      setPassword('')
      onClose()
    } catch (failure) {
      setError(adminError(failure))
      setPassword('')
    } finally {
      mutation.reset()
    }
  }

  const isDangerous = action === 'ban' || action === 'suspend'

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby="admin-action-title"
      aria-describedby="admin-action-impact"
      onCancel={event => {
        if (mutation.isPending) event.preventDefault()
        else onClose()
      }}
      className="w-[calc(100%_-_2rem)] max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto break-words rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl backdrop:bg-background/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/80">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              isDangerous
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            {isDangerous ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div>
            <h2 id="admin-action-title" className="text-lg font-bold leading-tight">
              {labels[action]}: {user.username}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Phiên bản quản trị: v{user.adminVersion} • UID: {user.id}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={mutation.isPending}
          className="rounded-lg p-1 text-muted-foreground hover:bg-surface-raised hover:text-foreground"
          aria-label="Đóng cửa sổ"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        id="admin-action-impact"
        className={`my-4 rounded-xl border p-3.5 text-xs sm:text-sm leading-relaxed ${
          isDangerous
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200'
            : 'border-indigo-500/20 bg-indigo-500/5 text-muted-foreground'
        }`}
      >
        {action === 'unban'
          ? 'Tài khoản được đăng nhập lại; phiên cũ vẫn bị thu hồi.'
          : 'Thay đổi có hiệu lực trên server và thu hồi phiên đăng nhập hiện tại của tài khoản này.'}{' '}
        Thao tác sẽ được ghi audit.
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {action === 'role' && (
          <label className="block space-y-1.5 text-xs sm:text-sm font-medium">
            <span>Quyền mới</span>
            <select
              value={role}
              onChange={event => setRole(event.target.value as AdminUser['role'])}
              className="w-full rounded-lg border border-border bg-background p-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {(['user', 'author', 'moderator', 'admin'] as const).map(value => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        )}

        {action === 'author-status' && (
          <label className="block space-y-1.5 text-xs sm:text-sm font-medium">
            <span>Trạng thái tác giả</span>
            <select
              value={status}
              onChange={event => setStatus(event.target.value as typeof status)}
              className="w-full rounded-lg border border-border bg-background p-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="approved">Duyệt tác giả</option>
              <option value="revoked">Thu hồi quyền tác giả</option>
            </select>
          </label>
        )}

        {action === 'suspend' && (
          <label className="block space-y-1.5 text-xs sm:text-sm font-medium">
            Số ngày (1–30)
            <input
              type="number"
              min={1}
              max={30}
              required
              value={days}
              onChange={event => setDays(Number(event.target.value))}
              className="w-full rounded-lg border border-border bg-background p-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        )}

        <label className="block space-y-1.5 text-xs sm:text-sm font-medium">
          Lý do (10–500 ký tự)
          <textarea
            required
            minLength={10}
            maxLength={500}
            rows={3}
            placeholder="Nêu rõ lý do thao tác quản trị cho audit trail…"
            value={reason}
            onChange={event => setReason(event.target.value)}
            className="w-full rounded-lg border border-border bg-background p-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <label className="block space-y-1.5 text-xs sm:text-sm font-medium">
          Mật khẩu của admin để xác minh lại
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            placeholder="Nhập mật khẩu tài khoản quản trị hiện tại"
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <p className="text-xs text-muted-foreground">
          Admin dùng OAuth-only cần luồng xác thực lại Google riêng; hiện chưa mở thao tác này.
        </p>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs sm:text-sm text-destructive font-medium">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-lg"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            variant={action === 'unban' ? 'default' : 'destructive'}
            disabled={mutation.isPending || reason.trim().length < 10 || !password}
            className="rounded-lg font-semibold"
          >
            {mutation.isPending ? 'Đang xác minh…' : 'Xác minh và thực hiện'}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body
  )
}

