import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  PenTool,
  BookOpen,
  FileText,
  Clock,
  AlertCircle,
  Database,
  Flame,
  BarChart3,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react'
import { adminApi } from '../api/admin.api'
import { useAdminQuery, adminError } from '../hooks/useAdmin'
import AdminChart from '../components/AdminChart'
import { Badge } from '@/components/ui/badge'
import type { Overview } from '../types'

const labels: Record<keyof Overview['kpis'], string> = {
  users: 'Tài khoản đăng ký',
  authors: 'Tác giả được duyệt, hoạt động',
  stories: 'Truyện được duyệt (gồm 18+)',
  publicChapters: 'Chương public (gồm 18+)',
  pendingStories: 'Truyện chờ duyệt',
  pendingChapters: 'Chương chờ duyệt',
  openReports: 'Báo cáo đang mở',
}

const kpiConfigs: Record<
  keyof Overview['kpis'],
  { icon: typeof Users; color: string; bg: string; border: string }
> = {
  users: {
    icon: Users,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
  authors: {
    icon: PenTool,
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
  },
  stories: {
    icon: BookOpen,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  publicChapters: {
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  pendingStories: {
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  pendingChapters: {
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  openReports: {
    icon: AlertCircle,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
}

export default function AdminOverviewPage() {
  const [metric, setMetric] = useState('users')
  const [range] = useState(() => {
    const now = new Date()
    return {
      to: now.toISOString().slice(0, 10),
      from: new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10),
    }
  })
  const overview = useAdminQuery('overview', {}, adminApi.overview)
  const chart = useAdminQuery('charts', { metric, ...range }, signal =>
    adminApi.charts({ metric, ...range }, signal)
  )

  return (
    <div className="space-y-6 break-words">
      {overview.isPending ? (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-xs">
          <div aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Đang tải số liệu…</span>
        </div>
      ) : overview.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive shadow-xs">
          <p className="font-semibold mb-1">Không thể tải số liệu tổng quan</p>
          <p>{adminError(overview.error)}</p>
        </div>
      ) : (
        <>
          {/* Metadata banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs sm:text-sm text-muted-foreground shadow-xs">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                Số liệu lúc {new Date(overview.data.asOf).toLocaleString('vi-VN')}. Counter lượt đọc là best-effort, không phải số người đọc.
              </span>
            </span>
          </div>

          {/* KPI Cards Grid */}
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(labels).map(([key, label]) => {
              const config = kpiConfigs[key as keyof Overview['kpis']] || {
                icon: TrendingUp,
                color: 'text-primary',
                bg: 'bg-primary/10',
                border: 'border-primary/20',
              }
              const Icon = config.icon
              const val = overview.data.kpis[key as keyof Overview['kpis']]
              const isWarning = (key === 'pendingStories' || key === 'pendingChapters' || key === 'openReports') && val > 0

              return (
                <div
                  key={key}
                  className={`group relative overflow-hidden rounded-xl border bg-card p-5 shadow-xs transition-all hover:shadow-md hover:border-primary/30 flex flex-col justify-between ${
                    isWarning ? 'border-amber-500/30' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-xs sm:text-sm font-medium text-muted-foreground leading-snug">
                      {label}
                    </dt>
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${config.bg} ${config.color} ${config.border} shadow-xs transition-transform group-hover:scale-105`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <dd className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-serif">
                      {val.toLocaleString('vi-VN')}
                    </dd>
                    {isWarning && (
                      <Badge variant="warning" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                        Cần xử lý
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </dl>

          {/* Infrastructure Health Section */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Hạ tầng & Dịch vụ cơ sở dữ liệu
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* MongoDB Status Box */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised/40 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="font-medium text-sm">MongoDB</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {overview.data.health.mongodb === 'available' ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Hoạt động ({overview.data.health.mongodb})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                      <XCircle className="h-4 w-4" /> {overview.data.health.mongodb}
                    </span>
                  )}
                </div>
              </div>

              {/* Redis Status Box */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised/40 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="font-medium text-sm">Redis</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {overview.data.health.redis === 'available' ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Hoạt động ({overview.data.health.redis})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                      <XCircle className="h-4 w-4" /> {overview.data.health.redis}
                    </span>
                  )}
                </div>
              </div>

              {/* Timestamp Check Box */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised/40 p-3.5 sm:col-span-2 lg:col-span-1">
                <span className="text-xs text-muted-foreground">Thời điểm kiểm tra</span>
                <span className="text-xs font-medium text-foreground">
                  {new Date(overview.data.health.checkedAt).toLocaleString('vi-VN')}
                </span>
              </div>
            </div>

            {/* Note to strictly keep contract text for tests and readers */}
            <p className="mt-3 text-xs text-muted-foreground border-t border-border/60 pt-3">
              MongoDB: {overview.data.health.mongodb}; Redis: {overview.data.health.redis}. Kiểm tra: {new Date(overview.data.health.checkedAt).toLocaleString('vi-VN')}.
            </p>
          </section>

          {/* Top 5 Stories Section */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-500" />
                <h2 className="text-base sm:text-lg font-semibold text-foreground">
                  Top 5 truyện theo bộ đếm hiện tại
                </h2>
              </div>
              <Badge variant="outline" className="text-xs font-normal">
                Counter tích lũy
              </Badge>
            </div>

            {overview.data.topStories.length ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <ol className="list-inside list-decimal divide-y divide-border bg-surface-raised/30">
                  {overview.data.topStories.map((story, index) => (
                    <li
                      key={story.id}
                      className="flex items-center justify-between gap-3 p-3 text-sm transition-colors hover:bg-surface-hover/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised font-bold text-xs text-muted-foreground">
                          {index + 1}
                        </span>
                        <Link
                          to={`/stories/${story.slug}`}
                          className="font-medium text-foreground hover:text-link hover:underline truncate"
                        >
                          {story.title}
                        </Link>
                        {story.contentWarning === 'mature18+' && (
                          <Badge variant="destructive" className="px-1.5 py-0 text-[10px] font-bold shrink-0">
                            (18+)
                          </Badge>
                        )}
                      </div>
                      <div className="shrink-0 font-mono text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
                        <span>{story.viewCount.toLocaleString('vi-VN')}</span>
                        <span className="text-[11px] text-muted-foreground/70">lượt đọc</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                <p>Chưa có truyện được duyệt.</p>
              </div>
            )}
          </section>
        </>
      )}

      {/* 30-Day Analytics Chart Section */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              Phân tích xu hướng 30 ngày
            </h2>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span>Biểu đồ 30 ngày</span>
            <select
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              value={metric}
              onChange={event => setMetric(event.target.value)}
            >
              <option value="users">Tài khoản mới</option>
              <option value="stories">Truyện tạo mới</option>
              <option value="views">Mẫu bộ đếm lượt đọc</option>
            </select>
          </label>
        </div>

        {chart.isPending ? (
          <div role="status" className="flex h-44 items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-raised/20 text-sm text-muted-foreground">
            <div aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Đang tải biểu đồ…</span>
          </div>
        ) : chart.isError ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-semibold mb-1">Không thể tải dữ liệu biểu đồ</p>
            <p>{adminError(chart.error)}</p>
          </div>
        ) : (
          <AdminChart chart={chart.data} />
        )}
      </section>
    </div>
  )
}

