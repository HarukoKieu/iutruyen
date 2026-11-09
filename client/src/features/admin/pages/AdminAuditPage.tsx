import { useState } from 'react'
import { FileText, Search, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { adminApi } from '../api/admin.api'
import { useAdminQuery, adminError } from '../hooks/useAdmin'
import AdminPagination from '../components/AdminPagination'

const actionBadges: Record<string, { label: string; className: string }> = {
  ban: { label: 'Ban', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  unban: { label: 'Mở khóa', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  suspend: { label: 'Đình chỉ', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  role: { label: 'Đổi quyền', className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  'author-status': { label: 'Quyền tác giả', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30' },
  config: { label: 'Cấu hình', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  backup: { label: 'Backup', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
}

export default function AdminAuditPage() {
  const [action, setAction] = useState('')
  const [actorId, setActorId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [filters, setFilters] = useState<object>({})
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])

  const params = { ...filters, cursor: cursors.at(-1), limit: 20 }
  const query = useAdminQuery('audit', params, signal => adminApi.audit(params, signal))

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-serif">
              Audit quản trị
            </h2>
            <p className="text-xs text-muted-foreground">
              Nhật ký bất biến ghi nhận mọi thao tác can thiệp dữ liệu và phân quyền
            </p>
          </div>
        </div>

        {query.data?.data && (
          <Badge variant="outline" className="self-start sm:self-auto text-xs px-2.5 py-1 font-mono">
            {query.data.data.length} bản ghi
          </Badge>
        )}
      </div>

      {/* Policy banner */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs sm:text-sm text-muted-foreground shadow-xs">
        <Shield className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
        <p className="leading-relaxed">
          Nhật ký chỉ đọc qua ứng dụng. Quyền quản trị database vẫn có thể thay đổi dữ liệu; cần policy vận hành riêng.
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <form
          onSubmit={event => {
            event.preventDefault()
            setFilters({
              action: action || undefined,
              actorId: actorId || undefined,
              targetId: targetId || undefined,
            })
            setCursors([undefined])
          }}
          className="admin-filters flex flex-wrap items-end gap-3"
        >
          <label className="w-full sm:w-auto min-w-[140px] text-xs sm:text-sm font-medium space-y-1.5">
            <span>Thao tác</span>
            <select
              value={action}
              onChange={event => setAction(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Tất cả</option>
              {['ban', 'unban', 'suspend', 'role', 'author-status', 'config', 'backup'].map(value => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="flex-1 min-w-[200px] text-xs sm:text-sm font-medium space-y-1.5">
            <span>Actor ID</span>
            <input
              placeholder="ObjectId 24 ký tự hex"
              value={actorId}
              pattern="[a-fA-F0-9]{24}"
              onChange={event => setActorId(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <label className="flex-1 min-w-[200px] text-xs sm:text-sm font-medium space-y-1.5">
            <span>Target ID</span>
            <input
              placeholder="ObjectId hoặc 'global'"
              value={targetId}
              pattern="([a-fA-F0-9]{24}|global)"
              onChange={event => setTargetId(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
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
          <span>Đang tải…</span>
        </div>
      ) : query.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive shadow-xs">
          <p className="font-semibold mb-1">Lỗi tải nhật ký audit</p>
          <p>{adminError(query.error)}</p>
        </div>
      ) : (
        <>
          {query.data.data.length ? (
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table role="table" className="admin-data-table w-full text-left text-sm">
                  <caption className="sr-only">Nhật ký quản trị</caption>
                  <thead className="bg-surface-raised border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    <tr>
                      {['Thời gian', 'Actor / thao tác', 'Target / lý do', 'Thay đổi'].map(label => (
                        <th key={label} scope="col" className="p-3.5">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {query.data.data.map(item => {
                      const actionConfig = actionBadges[item.action] || {
                        label: item.action,
                        className: 'bg-muted text-foreground',
                      }

                      return (
                        <tr key={item._id} className="transition-colors hover:bg-surface-hover/50">
                          {/* Timestamp & Request */}
                          <td data-label="Thời gian" className="p-3.5 align-top">
                            <div className="space-y-1">
                              <span className="font-medium text-foreground text-xs sm:text-sm">
                                {new Date(item.createdAt).toLocaleString('vi-VN')}
                              </span>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                Request: {item.requestId}
                              </div>
                            </div>
                          </td>

                          {/* Actor & Action */}
                          <td data-label="Actor / thao tác" className="p-3.5 align-top">
                            <div className="space-y-1.5">
                              <div className="text-xs font-mono font-medium text-foreground bg-surface-raised px-2 py-0.5 rounded border border-border inline-block">
                                {item.actorId}
                              </div>
                              <div>
                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border ${actionConfig.className}`}>
                                  {item.action}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Target & Reason */}
                          <td data-label="Target / lý do" className="p-3.5 align-top">
                            <div className="space-y-1">
                              <div className="text-xs font-mono text-muted-foreground">
                                {item.targetId}
                              </div>
                              <div className="text-xs sm:text-sm text-foreground break-words max-w-sm">
                                {item.reason}
                              </div>
                            </div>
                          </td>

                          {/* Diff changes */}
                          <td data-label="Thay đổi" className="p-3.5 align-top">
                            <details className="group rounded-lg border border-border bg-surface-raised/40 p-2 text-xs transition-colors">
                              <summary className="cursor-pointer font-medium text-indigo-600 dark:text-indigo-400 select-none flex items-center justify-between">
                                <span>Trước / sau</span>
                                <span className="group-open:rotate-180 transition-transform">▼</span>
                              </summary>
                              <pre className="mt-2 max-w-full overflow-auto rounded bg-card p-2.5 font-mono text-[11px] whitespace-pre-wrap break-all border border-border md:max-w-sm text-muted-foreground">
                                {JSON.stringify({ before: item.before, after: item.after }, null, 2)}
                              </pre>
                            </details>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 bg-card border-t border-border">
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
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-xs">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-base font-semibold text-foreground">Chưa có nhật ký phù hợp.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Không tìm thấy sự kiện audit nào tương ứng với điều kiện lọc
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

