import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HardDrive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { adminApi } from '../api/admin.api'
import { useAdminQuery, adminError } from '../hooks/useAdmin'

const statusBadges: Record<
  string,
  { label: string; className: string }
> = {
  queued: {
    label: 'Chờ chạy',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  running: {
    label: 'Đang chạy',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  succeeded: {
    label: 'Archive hoàn tất',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  failed: {
    label: 'Thất bại',
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
  },
}

export default function AdminBackupsPage() {
  const [cursors, setCursors] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [ack, setAck] = useState(false)
  const cursor = cursors.at(-1)
  const client = useQueryClient()

  const query = useAdminQuery('backups', { cursor }, signal =>
    adminApi.backups(signal, { cursor, limit: 20 })
  )

  const mutation = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: adminApi.enqueueBackup,
    onSuccess: async () => {
      setReason('')
      setAck(false)
      setCursors([])
      await client.invalidateQueries({ queryKey: ['admin'] })
    },
  })

  const busy = query.data?.items.some(
    job => job.status === 'queued' || job.status === 'running'
  )

  const labels: Record<string, string> = {
    queued: 'Chờ chạy',
    running: 'Đang chạy',
    succeeded: 'Archive hoàn tất',
    failed: 'Thất bại',
  }

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-serif">
              Sao lưu dữ liệu
            </h2>
            <p className="text-xs text-muted-foreground">
              Tạo và quản lý các bản sao lưu logical cho hệ thống cơ sở dữ liệu
            </p>
          </div>
        </div>

        {query.data?.items && (
          <Badge variant="outline" className="self-start sm:self-auto text-xs px-2.5 py-1 font-mono">
            {query.data.items.length} bản ghi sao lưu
          </Badge>
        )}
      </div>

      {query.isPending ? (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-xs">
          <div aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Đang tải…</span>
        </div>
      ) : query.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive shadow-xs">
          <p className="font-semibold mb-1">Lỗi tải dữ liệu sao lưu</p>
          <p>{adminError(query.error)}</p>
        </div>
      ) : (
        <>
          {/* Status & Architecture Warnings Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-indigo-500" />
                <p className="text-sm font-semibold">
                  Trạng thái: {query.data.status === 'NOT_CONFIGURED' ? 'Chưa cấu hình' : query.data.status}
                </p>
              </div>
              <Badge
                variant={query.data.status === 'READY' ? 'success' : 'warning'}
                className="text-xs font-medium"
              >
                {query.data.status === 'READY' ? 'Sẵn sàng sao lưu' : 'Chưa cấu hình đầy đủ'}
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground">{query.data.reason}</p>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Backup local cùng máy chưa bảo vệ khi mất máy. Archive logical không phải snapshot; cần dừng ghi để bảo đảm dữ liệu nhất quán và thử restore cô lập trước khi nghiệm thu phục hồi.
              </p>
            </div>
          </div>

          {/* Backup Queue Form */}
          {query.data.status === 'READY' && (
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
              <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                <span>Tạo yêu cầu sao lưu mới</span>
              </h3>

              <form
                className="space-y-4"
                onSubmit={event => {
                  event.preventDefault()
                  mutation.mutate(reason.trim())
                }}
              >
                <label className="block space-y-1.5 text-xs sm:text-sm font-medium">
                  Lý do backup (10–500 ký tự)
                  <textarea
                    className="w-full rounded-lg border border-border bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    minLength={10}
                    maxLength={500}
                    rows={3}
                    placeholder="Mục đích thực hiện bản sao lưu này…"
                    required
                    value={reason}
                    onChange={event => setReason(event.target.value)}
                    disabled={mutation.isPending || busy}
                  />
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs sm:text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={event => setAck(event.target.checked)}
                    disabled={mutation.isPending || busy}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  />
                  <span>Tôi hiểu archive không bảo đảm snapshot khi vẫn có thao tác ghi.</span>
                </label>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={!ack || reason.trim().length < 10 || mutation.isPending || busy}
                    className="rounded-lg px-5 py-2 font-semibold"
                  >
                    {mutation.isPending ? 'Đang gửi yêu cầu…' : 'Đưa backup vào hàng đợi'}
                  </Button>
                </div>

                {mutation.isPending && (
                  <p role="status" className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Đang gửi yêu cầu…
                  </p>
                )}
                {mutation.isSuccess && (
                  <p role="status" className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Đã tiếp nhận yêu cầu backup. Theo dõi kết quả trong lịch sử.
                  </p>
                )}
                {mutation.isError && (
                  <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs sm:text-sm text-destructive font-medium">
                    {adminError(mutation.error)}
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Backup History Table */}
          {query.data.items.length ? (
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table role="table" className="admin-data-table w-full text-left text-sm">
                  <caption className="sr-only">Lịch sử backup local</caption>
                  <thead className="bg-surface-raised border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    <tr>
                      <th scope="col" className="p-3.5">Tạo lúc</th>
                      <th scope="col" className="p-3.5">Trạng thái</th>
                      <th scope="col" className="p-3.5">Dung lượng mã hóa</th>
                      <th scope="col" className="p-3.5">Kết quả kiểm tra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {query.data.items.map(job => {
                      const statusConfig = statusBadges[job.status] || {
                        label: labels[job.status] || job.status,
                        className: 'bg-muted text-foreground',
                      }

                      return (
                        <tr key={job.id} className="transition-colors hover:bg-surface-hover/50">
                          {/* Created timestamp */}
                          <td data-label="Tạo lúc" className="p-3.5 align-middle">
                            <div className="font-medium text-foreground">
                              {new Date(job.createdAt).toLocaleString('vi-VN')}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              ID: {job.id}
                            </div>
                          </td>

                          {/* Status */}
                          <td data-label="Trạng thái" className="p-3.5 align-middle">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold border ${statusConfig.className}`}
                            >
                              {job.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                              {labels[job.status]}
                            </span>
                          </td>

                          {/* Encrypted Size */}
                          <td data-label="Dung lượng mã hóa" className="p-3.5 align-middle font-mono text-xs sm:text-sm">
                            {job.sizeBytes === undefined ? '—' : `${job.sizeBytes.toLocaleString('vi-VN')} bytes`}
                          </td>

                          {/* Checksum / Error */}
                          <td data-label="Kết quả kiểm tra" className="p-3.5 align-middle break-all font-mono text-xs text-muted-foreground max-w-sm">
                            {job.errorCode ?? (job.sha256 ? `SHA256: ${job.sha256}` : 'Chưa có checksum')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-xs">
              <Database className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-base font-semibold text-foreground">Chưa có bản sao lưu được ghi nhận.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Các bản lưu trữ archive sẽ hiển thị tại đây sau khi được đưa vào hàng đợi
              </p>
            </div>
          )}

          {/* Action buttons (Refresh & Pagination) */}
          {(query.data.status === 'READY' || query.data.items.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg flex items-center gap-2"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
                <span>Cập nhật trạng thái</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={!cursors.length || query.isFetching}
                  onClick={() => setCursors(previous => previous.slice(0, -1))}
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={!query.data.meta?.hasMore || query.isFetching}
                  onClick={() => {
                    const next = query.data.meta?.nextCursor
                    if (next) setCursors(previous => [...previous, next])
                  }}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

