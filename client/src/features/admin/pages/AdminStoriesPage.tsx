import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { adminApi } from '../api/admin.api'
import { useAdminQuery, adminError } from '../hooks/useAdmin'
import AdminPagination from '../components/AdminPagination'
import AdminStoryActionDialog from '../components/AdminStoryActionDialog'
import type { AdminStory } from '../types'

const modStatusBadges: Record<
  string,
  { label: string; className: string }
> = {
  approved: {
    label: 'Đã duyệt',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  pending: {
    label: 'Chờ duyệt',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  hidden: {
    label: 'Đang ẩn',
    className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
  },
  removed: {
    label: 'Đã gỡ',
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
  },
}

export default function AdminStoriesPage() {
  const [status, setStatus] = useState('')
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [action, setAction] = useState<{
    story: AdminStory
    type: 'approve' | 'hide' | 'remove'
  } | null>(null)

  const params = {
    moderationStatus: status || undefined,
    q: q || undefined,
    cursor: cursors.at(-1),
    limit: 20,
  }

  const query = useAdminQuery('stories', params, signal => adminApi.stories(params, signal))

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-serif">
              Quản lý truyện
            </h2>
            <p className="text-xs text-muted-foreground">
              Giám sát trạng thái xuất bản, nội dung cảnh báo và quyền hiển thị công khai
            </p>
          </div>
        </div>

        {query.data?.data && (
          <Badge variant="outline" className="self-start sm:self-auto text-xs px-2.5 py-1 font-mono">
            {query.data.data.length} truyện trong trang
          </Badge>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <form
          onSubmit={event => {
            event.preventDefault()
            setQ(draft.trim())
            setCursors([undefined])
          }}
          className="admin-filters flex flex-wrap items-end gap-3"
        >
          <label className="flex-1 min-w-[200px] text-xs sm:text-sm font-medium space-y-1.5">
            <span>Tìm đầu tên truyện</span>
            <input
              maxLength={100}
              placeholder="Nhập tên truyện cần tra cứu…"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <label className="w-full sm:w-auto min-w-[150px] text-xs sm:text-sm font-medium space-y-1.5">
            <span>Kiểm duyệt</span>
            <select
              value={status}
              onChange={event => {
                setStatus(event.target.value)
                setCursors([undefined])
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Tất cả</option>
              {['pending', 'approved', 'hidden', 'removed'].map(value => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
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
          <span>Đang tải truyện…</span>
        </div>
      ) : query.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive shadow-xs">
          <p className="font-semibold mb-1">Lỗi tải danh sách truyện</p>
          <p>{adminError(query.error)}</p>
        </div>
      ) : (
        <>
          {query.data.data.length ? (
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table role="table" className="admin-data-table w-full text-left text-sm">
                  <caption className="sr-only">Danh sách truyện quản trị</caption>
                  <thead className="bg-surface-raised border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    <tr>
                      {['Truyện', 'Kiểm duyệt', 'Chương / counter', 'Thao tác'].map(label => (
                        <th scope="col" key={label} className="p-3.5">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {query.data.data.map(story => {
                      const modConfig = modStatusBadges[story.moderationStatus]

                      return (
                        <tr key={story.id} className="transition-colors hover:bg-surface-hover/50">
                          {/* Story Info */}
                          <td data-label="Truyện" className="p-3.5 align-middle">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <Link
                                to={`/stories/${story.slug}`}
                                className="font-semibold text-foreground hover:text-link hover:underline transition-colors"
                              >
                                {story.title}
                              </Link>
                              {story.contentWarning === 'mature18+' && (
                                <Badge variant="destructive" className="px-1.5 py-0 text-[10px] font-bold">
                                  (18+)
                                </Badge>
                              )}
                            </div>
                          </td>

                          {/* Moderation Status */}
                          <td data-label="Kiểm duyệt" className="p-3.5 align-middle">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border ${
                                modConfig?.className || 'border-border bg-surface-raised'
                              }`}
                            >
                              {story.moderationStatus}
                            </span>
                          </td>

                          {/* Chapters / Views counter */}
                          <td data-label="Chương / counter" className="p-3.5 align-middle font-mono text-xs sm:text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground">{story.chapterCount}</span>
                              <span>/</span>
                              <span>{story.viewCount.toLocaleString('vi-VN')}</span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td data-label="Thao tác" className="p-3.5 align-middle">
                            <div className="flex flex-wrap gap-2">
                              {story.moderationStatus !== 'removed' &&
                                (['approve', 'hide', 'remove'] as const)
                                  .filter(
                                    type =>
                                      !(type === 'approve' && story.moderationStatus === 'approved') &&
                                      !(type === 'hide' && story.moderationStatus === 'hidden')
                                  )
                                  .map(type => {
                                    const isApprove = type === 'approve'
                                    const isHide = type === 'hide'
                                    const isRemove = type === 'remove'

                                    return (
                                      <Button
                                        key={type}
                                        size="sm"
                                        variant={isRemove ? 'destructive' : 'outline'}
                                        onClick={() => setAction({ story, type })}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                                          isApprove
                                            ? 'border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300'
                                            : isHide
                                            ? 'border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300'
                                            : ''
                                        }`}
                                      >
                                        {isApprove ? 'Duyệt' : isHide ? 'Ẩn' : 'Gỡ'}
                                      </Button>
                                    )
                                  })}
                            </div>
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
              <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-base font-semibold text-foreground">Không có truyện phù hợp.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Không tìm thấy tác phẩm nào theo tiêu chí bộ lọc đã chọn
              </p>
            </div>
          )}
        </>
      )}

      {action && (
        <AdminStoryActionDialog
          story={action.story}
          action={action.type}
          onClose={() => setAction(null)}
        />
      )}
    </section>
  )
}

