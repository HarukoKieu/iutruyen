import { REPORT_REASON_LABELS as REASON_LABELS } from '../reportReasons'
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useReportDetail, useModerationAction, useAddReportNote } from '../hooks/useModeration'
import type { ReportActionInput, ReportTargetData, ModerationLogItem } from '@/types/moderation'


const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Chờ xử lý', cls: 'badge-pending' },
  in_progress: { label: 'Đang xử lý', cls: 'badge-in-progress' },
  resolved: { label: 'Đã giải quyết', cls: 'badge-approved' },
  dismissed: { label: 'Đã từ chối', cls: 'badge-hidden' },
}

const ACTION_OPTIONS: { value: ReportActionInput['action']; label: string; color: string }[] = [
  { value: 'dismiss', label: 'Từ chối báo cáo', color: '#6b7280' },
  { value: 'request_revision', label: 'Yêu cầu chỉnh sửa', color: '#8b5cf6' },
  { value: 'hide', label: 'Ẩn nội dung', color: '#f59e0b' },
  { value: 'remove', label: 'Gỡ bỏ nội dung', color: '#ef4444' },
  { value: 'warn_user', label: 'Cảnh báo người dùng', color: '#f97316' },
]

function timeStr(dateStr: string) {
  return new Date(dateStr).toLocaleString('vi-VN')
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

// ─── Target Preview ───────────────────────────────────────────────────────────

function TargetPreview({ targetType, targetData }: { targetType: string; targetData: ReportTargetData }) {
  if (!targetData) return <div className="mod-target-preview empty">Không tìm thấy đối tượng</div>

  if (targetType === 'story') {
    const story = targetData
    return (
      <div className="mod-target-preview story">
        {story.coverUrl && (
          <img src={story.coverUrl} alt={story.title} className="mod-target-cover" />
        )}
        <div className="mod-target-info">
          <div className="mod-target-name">{story.title}</div>
          <div className="mod-target-meta">
            Tác giả: {story.authorId?.displayName ?? story.authorId?.username ?? '—'}
          </div>
          <div className="mod-target-meta">
            Trạng thái kiểm duyệt:{' '}
            <strong>{story.moderationStatus ?? '—'}</strong>
          </div>
          {story.description && (
            <p className="mod-target-desc">{story.description?.slice(0, 200)}…</p>
          )}
        </div>
      </div>
    )
  }

  if (targetType === 'chapter') {
    return (
      <div className="mod-target-preview chapter">
        <div className="mod-target-info">
          <div className="mod-target-name">{targetData.title}</div>
          <div className="mod-target-meta">Chương {targetData.order}</div>
          <div className="mod-target-meta">
            Thuộc truyện: {typeof targetData.storyId === 'object' ? targetData.storyId?.title ?? '—' : '—'}
          </div>
        </div>
      </div>
    )
  }

  if (targetType === 'comment') {
    return (
      <div className="mod-target-preview comment">
        <div className="mod-target-info">
          <div className="mod-target-name">
            Bình luận của {targetData.userId?.displayName ?? targetData.userId?.username ?? '—'}
          </div>
          <blockquote className="mod-target-quote">"{targetData.content}"</blockquote>
          <div className="mod-target-meta">
            Trong truyện: {typeof targetData.storyId === 'object' ? targetData.storyId?.title ?? '—' : '—'}
          </div>
        </div>
      </div>
    )
  }

  if (targetType === 'user') {
    return (
      <div className="mod-target-preview user">
        <div className="mod-target-info">
          <div className="mod-target-name">{targetData.displayName ?? targetData.username}</div>
          <div className="mod-target-meta">Email: {targetData.email}</div>
          <div className="mod-target-meta">Vai trò: {targetData.role}</div>
          {targetData.isLocked && (
            <div className="mod-target-meta locked">⛔ Tài khoản đã bị tạm đình chỉ</div>
          )}
        </div>
      </div>
    )
  }

  return null
}

// ─── Action Panel ─────────────────────────────────────────────────────────────

function ActionPanel({
  reportId,
  status,
  onActionSuccess,
}: {
  reportId: string
  status: string
  onActionSuccess: () => void
}) {
  const [selectedAction, setSelectedAction] = useState<ReportActionInput['action']>('dismiss')
  const [note, setNote] = useState('')
  const [notifyUser, setNotifyUser] = useState(true)
  const [noteText, setNoteText] = useState('')

  const actionMut = useModerationAction()
  const noteMut = useAddReportNote()

  const handleAction = (e: React.FormEvent) => {
    e.preventDefault()
    actionMut.mutate(
      {
        id: reportId,
        body: {
          action: selectedAction,
          note: note || undefined,
          notifyUser,
        },
      },
      { onSuccess: onActionSuccess }
    )
  }

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return
    noteMut.mutate({ id: reportId, note: noteText }, { onSuccess: () => setNoteText('') })
  }

  const isResolved = status === 'resolved' || status === 'dismissed'

  return (
    <div className="mod-action-panel">
      <div className="mod-action-panel-title">⚡ Xử lý báo cáo</div>

      {isResolved ? (
        <div className="mod-action-resolved">
          Báo cáo này đã được xử lý ({STATUS_META[status]?.label ?? status}).
        </div>
      ) : (
        <form onSubmit={handleAction} className="mod-action-form" id="report-action-form">
          <div className="mod-action-field">
            <label className="mod-modal-label">Hành động</label>
            <div className="mod-action-options" role="group" aria-label="Hành động xử lý báo cáo">
              {ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  id={`action-option-${opt.value}`}
                  className={`mod-action-option${selectedAction === opt.value ? ' selected' : ''}`}
                  aria-pressed={selectedAction === opt.value}
                  style={selectedAction === opt.value ? { borderColor: opt.color, background: `${opt.color}15` } : {}}
                  onClick={() => setSelectedAction(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mod-action-field">
            <label className="mod-modal-label" htmlFor="action-note">Ghi chú / Lý do</label>
            <textarea
              id="action-note"
              className="mod-modal-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú thêm cho quyết định này..."
              rows={3}
            />
          </div>

          <label className="mod-modal-checkbox-row" htmlFor="action-notify-user">
            <input
              id="action-notify-user"
              type="checkbox"
              className="mod-modal-checkbox"
              checked={notifyUser}
              onChange={(e) => setNotifyUser(e.target.checked)}
            />
            <span>Gửi thông báo cho người liên quan</span>
          </label>

          <button
            id="action-submit-btn"
            type="submit"
            className="btn-mod-primary"
            disabled={actionMut.isPending}
          >
            {actionMut.isPending ? 'Đang xử lý...' : 'Xác nhận hành động'}
          </button>
        </form>
      )}

      {/* Internal Note */}
      <div className="mod-note-section">
        <div className="mod-action-panel-title">📝 Thêm ghi chú nội bộ</div>
        <form onSubmit={handleAddNote} className="mod-note-form">
          <textarea
            id="internal-note-input"
            aria-label="Ghi chú nội bộ"
            className="mod-modal-textarea"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Ghi chú cho nhóm kiểm duyệt..."
            rows={2}
          />
          <button
            id="add-note-btn"
            type="submit"
            className="btn-mod-outline"
            disabled={!noteText.trim() || noteMut.isPending}
          >
            Thêm ghi chú
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useReportDetail(id || '')

  if (isLoading) {
    return (
      <div className="mod-page">
        <div className="mod-queue-loading" role="status">Đang tải chi tiết báo cáo...</div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mod-page">
        <div className="mod-queue-error" role="alert">Không thể tải báo cáo. <Link to="/mod/reports">← Quay lại</Link></div>
      </div>
    )
  }

  const { report, targetData, stats, targetAuditLogs } = data
  const reporter = report.reporterId
  const statusMeta = STATUS_META[report.status] ?? { label: report.status, cls: '' }
  const displayReportNumber = report.reportNumber || `#${report._id.slice(-6).toUpperCase()}`

  return (
    <div className="mod-page">
      {/* Header */}
      <div className="mod-page-header">
        <div className="mod-page-breadcrumb">
          <Link to="/mod/reports" id="report-detail-back">← Danh sách báo cáo</Link>
          <span> / Chi tiết báo cáo</span>
        </div>
        <div className="mod-page-title-row">
          <h1 className="mod-page-title">Báo cáo {displayReportNumber}</h1>
          <span className={`mod-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="mod-detail-grid">
        {/* Left Column */}
        <div className="mod-detail-left">
          {/* Reporter Info */}
          <div className="mod-detail-card" id="reporter-info">
            <div className="mod-detail-card-title">👤 Người báo cáo</div>
            <div className="mod-detail-info-row">
              <span>Tên:</span>
              <strong>{reporter?.displayName ?? reporter?.username ?? '—'}</strong>
            </div>
            <div className="mod-detail-info-row">
              <span>Tổng báo cáo đã gửi:</span>
              <strong>{stats.reporterTotalReportsCount}</strong>
            </div>
            <div className="mod-detail-info-row">
              <span>Thời gian gửi:</span>
              <span>{timeStr(report.createdAt)}</span>
            </div>
          </div>

          {/* Report Reason */}
          <div className="mod-detail-card" id="report-reason">
            <div className="mod-detail-card-title">⚠️ Lý do vi phạm</div>
            <div className="mod-reason-tag">{REASON_LABELS[report.reason] ?? report.reason}</div>
            {report.description && (
              <p className="mod-detail-desc">"{report.description}"</p>
            )}
            {report.evidenceUrls && report.evidenceUrls.length > 0 && (
              <div className="mod-evidence-list">
                <div className="mod-detail-label">Bằng chứng đính kèm:</div>
                {report.evidenceUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="mod-evidence-link" id={`evidence-${i}`}>
                    🔗 Bằng chứng {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Target Content */}
          <div className="mod-detail-card" id="target-content">
            <div className="mod-detail-card-title">
              Đối tượng bị báo cáo &mdash; {report.targetType}
              {stats.targetOtherReportsCount > 0 && (
                <span className="mod-report-count-badge">{stats.targetOtherReportsCount} báo cáo khác</span>
              )}
            </div>
            <TargetPreview targetType={report.targetType} targetData={targetData} />
          </div>

          {/* Audit Trail */}
          {targetAuditLogs && targetAuditLogs.length > 0 && (
            <div className="mod-detail-card" id="audit-trail">
              <div className="mod-detail-card-title">📋 Lịch sử kiểm duyệt đối tượng</div>
              <div className="mod-audit-list">
                {targetAuditLogs.map((log: ModerationLogItem) => (
                  <div key={log._id} className="mod-audit-item">
                    <span className="mod-audit-action">{log.action}</span>
                    <span className="mod-audit-mod">bởi {log.moderatorId?.displayName ?? '—'}</span>
                    <span className="mod-audit-time">{timeAgo(log.createdAt)}</span>
                    {log.reason && <span className="mod-audit-reason">· {log.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Internal Notes */}
          {report.notes && report.notes.length > 0 && (
            <div className="mod-detail-card" id="report-notes">
              <div className="mod-detail-card-title">📝 Ghi chú nội bộ</div>
              <div className="mod-notes-list">
                {report.notes.map((n, i) => (
                  <div key={i} className="mod-note-item">
                    <div className="mod-note-header">
                      <strong>{n.moderatorId?.displayName ?? '—'}</strong>
                      <span>{timeStr(n.createdAt)}</span>
                    </div>
                    <p className="mod-note-text">{n.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution */}
          {report.resolution && (
            <div className="mod-detail-card" id="report-resolution">
              <div className="mod-detail-card-title">✅ Kết quả xử lý</div>
              <div className="mod-detail-info-row">
                <span>Hành động:</span>
                <strong>{report.resolution.action}</strong>
              </div>
              {report.resolution.note && (
                <div className="mod-detail-info-row">
                  <span>Ghi chú:</span>
                  <span>{report.resolution.note}</span>
                </div>
              )}
              <div className="mod-detail-info-row">
                <span>Giải quyết lúc:</span>
                <span>{timeStr(report.resolution.resolvedAt)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column — Sticky Action Panel */}
        <div className="mod-detail-right">
          <div className="mod-action-panel-sticky">
            <ActionPanel
              reportId={report._id}
              status={report.status}
              onActionSuccess={() => { void refetch() }}
            />

            {/* Quick Nav */}
            <div className="mod-quick-nav">
              <button
                id="report-prev-btn"
                className="btn-mod-outline"
                onClick={() => navigate(-1)}
              >
                ← Quay lại
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
