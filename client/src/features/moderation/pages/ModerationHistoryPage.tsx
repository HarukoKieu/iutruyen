import { useState, useMemo } from 'react'
import { useModerationHistory } from '../hooks/useModeration'
import type { ModerationLogItem } from '@/types/moderation'

type RangeFilter = 'all' | '24h' | '7d' | '30d'
type TypeFilter = 'all' | 'story' | 'chapter' | 'comment' | 'user' | 'report'

const ACTION_COLORS: Record<string, string> = {
  approve_story: '#22c55e',
  approve_chapter: '#22c55e',
  approve_comment: '#22c55e',
  hide_story: '#f59e0b',
  hide_chapter: '#f59e0b',
  hide_comment: '#f59e0b',
  remove_story: '#ef4444',
  remove_chapter: '#ef4444',
  delete_comment: '#ef4444',
  request_revision_story: '#8b5cf6',
  resolve_report: '#3b82f6',
  dismiss_report: '#6b7280',
  warn_user: '#f97316',
  suspend_user: '#dc2626',
  add_report_note: '#60a5fa',
  assign_report: '#a78bfa',
}

const ACTION_LABELS: Record<string, string> = {
  approve_story: 'Duyệt truyện',
  approve_chapter: 'Duyệt chương',
  approve_comment: 'Duyệt bình luận',
  hide_story: 'Ẩn truyện',
  hide_chapter: 'Ẩn chương',
  hide_comment: 'Ẩn bình luận',
  remove_story: 'Gỡ truyện',
  remove_chapter: 'Gỡ chương',
  delete_comment: 'Xóa bình luận',
  request_revision_story: 'Yêu cầu sửa',
  resolve_report: 'Xử lý báo cáo',
  dismiss_report: 'Từ chối báo cáo',
  warn_user: 'Cảnh báo user',
  suspend_user: 'Đình chỉ user',
  add_report_note: 'Thêm ghi chú',
  assign_report: 'Gán báo cáo',
}

function timeStr(dateStr: string) {
  return new Date(dateStr).toLocaleString('vi-VN')
}

export default function ModerationHistoryPage() {
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('7d')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [actionFilter, setActionFilter] = useState('')

  const params = {
    range: rangeFilter,
    targetType: typeFilter === 'all' ? undefined : typeFilter,
    action: actionFilter || undefined,
    limit: 30,
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useModerationHistory(params)

  const logs = useMemo(() => data?.pages.flatMap((p) => p.logs) ?? [], [data])

  const rangeTabs: { key: RangeFilter; label: string }[] = [
    { key: '24h', label: '24 giờ' },
    { key: '7d', label: '7 ngày' },
    { key: '30d', label: '30 ngày' },
    { key: 'all', label: 'Tất cả' },
  ]

  return (
    <div className="mod-page">
      <div className="mod-page-header">
        <h1 className="mod-page-title">Lịch Sử Kiểm Duyệt</h1>
        <p className="mod-page-subtitle">Nhật ký kiểm duyệt bất biến — không thể chỉnh sửa hay xóa</p>
      </div>

      {/* Range Tabs */}
      <div className="mod-tabs" role="tablist" aria-label="Khoảng thời gian" onKeyDown={event => {
        const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        const current = controls.indexOf(event.target as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : event.key === 'ArrowRight' ? (current + 1) % controls.length : event.key === 'ArrowLeft' ? (current + controls.length - 1) % controls.length : -1
        if (next >= 0) { event.preventDefault(); controls[next]?.focus(); controls[next]?.click() }
      }}>
        {rangeTabs.map((tab) => (
          <button
            key={tab.key}
            id={`history-range-${tab.key}`}
            role="tab"
            aria-selected={rangeFilter === tab.key}
            aria-controls="moderation-history-panel"
            tabIndex={rangeFilter === tab.key ? 0 : -1}
            className={`mod-tab${rangeFilter === tab.key ? ' active' : ''}`}
            onClick={() => setRangeFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mod-filters">
        <select
          id="history-type-filter"
          aria-label="Lọc loại đối tượng kiểm duyệt"
          className="mod-sort-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
        >
          <option value="all">Tất cả loại</option>
          <option value="story">Truyện</option>
          <option value="chapter">Chương</option>
          <option value="comment">Bình luận</option>
          <option value="user">Người dùng</option>
          <option value="report">Báo cáo</option>
        </select>

        <select
          id="history-action-filter"
          aria-label="Lọc hành động kiểm duyệt"
          className="mod-sort-select"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">Tất cả hành động</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Log Table */}
      <div id="moderation-history-panel" role="tabpanel" aria-labelledby={`history-range-${rangeFilter}`}>
      {isLoading && <div className="mod-queue-loading" role="status">Đang tải nhật ký...</div>}
      {isError && <div className="mod-queue-error" role="alert">Không thể tải lịch sử kiểm duyệt.</div>}
      {!isLoading && !isError && !logs.length && (
        <div className="mod-queue-empty">Không có nhật ký nào trong khoảng thời gian này.</div>
      )}

      {logs.length > 0 && (
        <div className="mod-reports-table-wrapper">
          <table className="mod-reports-table" id="history-table">
            <caption className="sr-only">Lịch sử kiểm duyệt</caption>
            <thead>
              <tr>
                <th scope="col">Hành động</th>
                <th scope="col">Đối tượng</th>
                <th scope="col">Tiêu đề</th>
                <th scope="col">Kiểm duyệt viên</th>
                <th scope="col">Lý do</th>
                <th scope="col">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: ModerationLogItem) => {
                const color = ACTION_COLORS[log.action] ?? '#6b7280'
                const label = ACTION_LABELS[log.action] ?? log.action
                const mod = log.moderatorId
                return (
                  <tr key={log._id} id={`history-row-${log._id}`} className="mod-reports-row">
                    <td data-label="Hành động">
                      <span
                        className="mod-action-label-chip"
                        style={{ background: `${color}20`, color }}
                      >
                        {label}
                      </span>
                    </td>
                    <td data-label="Đối tượng">
                      <span className="mod-type-label">{log.targetType}</span>
                    </td>
                    <td data-label="Tiêu đề" className="mod-history-title">
                      {log.targetTitle ?? <span className="text-muted">—</span>}
                    </td>
                    <td data-label="Kiểm duyệt viên">
                      <span className="mod-reporter-name">
                        {mod?.displayName ?? mod?.username ?? '—'}
                      </span>
                    </td>
                    <td data-label="Lý do" className="mod-history-reason">
                      {log.reason ?? <span className="text-muted">—</span>}
                    </td>
                    <td data-label="Thời gian" className="mod-reports-time">{timeStr(log.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasNextPage && (
        <button
          id="history-load-more"
          className="btn-mod-load-more"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Đang tải...' : 'Tải thêm nhật ký'}
        </button>
      )}
      </div>
    </div>
  )
}
