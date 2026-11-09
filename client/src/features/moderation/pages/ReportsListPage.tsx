import { REPORT_REASON_LABELS as REASON_LABELS } from '../reportReasons'
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useReportsList } from '../hooks/useModeration'

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'resolved' | 'dismissed'
type TypeFilter = 'all' | 'story' | 'chapter' | 'comment' | 'user'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Chờ xử lý', cls: 'badge-pending' },
  in_progress: { label: 'Đang xử lý', cls: 'badge-in-progress' },
  resolved: { label: 'Đã giải quyết', cls: 'badge-approved' },
  dismissed: { label: 'Đã từ chối', cls: 'badge-hidden' },
}

const TYPE_ICONS: Record<string, string> = {
  story: '📚',
  chapter: '📄',
  comment: '💬',
  user: '👤',
}


function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  return `${d} ngày trước`
}

export default function ReportsListPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const params = {
    status: statusFilter === 'all' ? undefined : statusFilter,
    targetType: typeFilter === 'all' ? undefined : typeFilter,
    limit: 20,
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useReportsList(params)

  const reports = useMemo(() => data?.pages.flatMap((p) => p.reports) ?? [], [data])

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chờ xử lý' },
    { key: 'in_progress', label: 'Đang xử lý' },
    { key: 'resolved', label: 'Đã giải quyết' },
    { key: 'dismissed', label: 'Đã từ chối' },
  ]

  return (
    <div className="mod-page">
      <div className="mod-page-header">
        <h1 className="mod-page-title">Báo Cáo Vi Phạm</h1>
        <p className="mod-page-subtitle">Xem và xử lý các báo cáo từ người dùng</p>
      </div>

      {/* Status Tabs */}
      <div className="mod-tabs" role="tablist" aria-label="Trạng thái báo cáo" onKeyDown={event => {
        const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        const current = controls.indexOf(event.target as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : event.key === 'ArrowRight' ? (current + 1) % controls.length : event.key === 'ArrowLeft' ? (current + controls.length - 1) % controls.length : -1
        if (next >= 0) { event.preventDefault(); controls[next]?.focus(); controls[next]?.click() }
      }}>
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            id={`reports-status-${tab.key}`}
            role="tab"
            aria-selected={statusFilter === tab.key}
            aria-controls="reports-panel"
            tabIndex={statusFilter === tab.key ? 0 : -1}
            className={`mod-tab${statusFilter === tab.key ? ' active' : ''}`}
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div className="mod-filters">
        <select
          id="reports-type-filter"
          aria-label="Lọc loại đối tượng báo cáo"
          className="mod-sort-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
        >
          <option value="all">Tất cả loại</option>
          <option value="story">Truyện</option>
          <option value="chapter">Chương</option>
          <option value="comment">Bình luận</option>
          <option value="user">Người dùng</option>
        </select>
      </div>

      {/* Reports Table */}
      <div id="reports-panel" role="tabpanel" aria-labelledby={`reports-status-${statusFilter}`}>
      {isLoading && <div className="mod-queue-loading" role="status">Đang tải...</div>}
      {isError && <div className="mod-queue-error" role="alert">Không thể tải danh sách báo cáo.</div>}
      {!isLoading && !isError && !reports.length && (
        <div className="mod-queue-empty">✅ Không có báo cáo nào phù hợp.</div>
      )}

      {reports.length > 0 && (
        <div className="mod-reports-table-wrapper">
          <table className="mod-reports-table" id="reports-table">
            <caption className="sr-only">Danh sách báo cáo vi phạm</caption>
            <thead>
              <tr>
                <th scope="col">Loại</th>
                <th scope="col">Lý do</th>
                <th scope="col">Người báo cáo</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Thời gian</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const statusMeta = STATUS_META[report.status] ?? { label: report.status, cls: '' }
                const reporter = report.reporterId
                return (
                  <tr key={report._id} id={`report-row-${report._id}`} className="mod-reports-row">
                    <td data-label="Loại">
                      <span className="mod-type-icon">{TYPE_ICONS[report.targetType] ?? '❓'}</span>
                      <span className="mod-type-label">{report.targetType}</span>
                    </td>
                    <td data-label="Lý do">
                      <span className="mod-reason-text">
                        {REASON_LABELS[report.reason] ?? report.reason}
                      </span>
                      {report.description && (
                        <div className="mod-reason-desc">"{report.description.slice(0, 60)}…"</div>
                      )}
                    </td>
                    <td data-label="Người báo cáo">
                      <span className="mod-reporter-name">
                        {reporter?.displayName ?? reporter?.username ?? '—'}
                      </span>
                    </td>
                    <td data-label="Trạng thái">
                      <span className={`mod-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
                    </td>
                    <td data-label="Thời gian" className="mod-reports-time">{timeAgo(report.createdAt)}</td>
                    <td data-label="Thao tác">
                      <Link
                        to={`/mod/reports/${report._id}`}
                        id={`report-detail-${report._id}`}
                        className="btn-mod-outline"
                      >
                        Xem chi tiết →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasNextPage && (
        <button
          id="reports-load-more"
          className="btn-mod-load-more"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Đang tải...' : 'Tải thêm báo cáo'}
        </button>
      )}
      </div>
    </div>
  )
}
