import { useRef, useState } from 'react'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'
import type { ModerationActionInput } from '@/types/moderation'

interface Props {
  isOpen: boolean
  targetType: 'story' | 'chapter' | 'comment'
  targetTitle: string
  action: 'approve' | 'hide' | 'remove' | 'request_revision' | 'delete'
  onConfirm: (data: ModerationActionInput) => void
  onClose: () => void
  isPending?: boolean
}

const PRESET_REASONS: Record<string, string[]> = {
  hide: [
    'Nội dung 18+ không gắn nhãn',
    'Bạo lực, máu me quá mức',
    'Ngôn từ kích động, thù địch',
    'Vi phạm bản quyền',
    'Spam hoặc nội dung lặp lại',
    'Thông tin sai lệch',
  ],
  remove: [
    'Vi phạm nghiêm trọng quy tắc cộng đồng',
    'Nội dung không phù hợp với mọi đối tượng',
    'Vi phạm bản quyền sau cảnh báo',
    'Lừa đảo hoặc gian lận',
  ],
  request_revision: [
    'Mô tả không đầy đủ hoặc thiếu thể loại',
    'Tiêu đề gây hiểu nhầm',
    'Hình ảnh bìa không phù hợp',
    'Cần bổ sung cảnh báo nội dung',
  ],
  delete: [
    'Spam hoặc quảng cáo',
    'Nội dung xúc phạm người khác',
    'Ngôn từ kỳ thị hoặc phân biệt đối xử',
    'Bình luận không liên quan',
  ],
  approve: [],
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  approve: { label: 'Duyệt', color: '#22c55e' },
  hide: { label: 'Ẩn', color: '#f59e0b' },
  remove: { label: 'Gỡ bỏ', color: '#ef4444' },
  request_revision: { label: 'Yêu cầu chỉnh sửa', color: '#8b5cf6' },
  delete: { label: 'Xóa', color: '#ef4444' },
}

export default function ModerationActionModal({
  isOpen,
  targetType,
  targetTitle,
  action,
  onConfirm,
  onClose,
  isPending = false,
}: Props) {
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [note, setNote] = useState('')
  const [notifyUser, setNotifyUser] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  useModalAccessibility({ open: isOpen, onClose: () => { if (!isPending) onClose() }, containerRef })

  if (!isOpen) return null

  const presets = PRESET_REASONS[action] ?? []
  const actionMeta = ACTION_LABELS[action] ?? { label: action, color: '#6b7280' }
  const finalReason = selectedReason === '__custom__' ? customReason : selectedReason

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfirm({ reason: finalReason || undefined, note: note || undefined, notifyUser })
    setSelectedReason('')
    setCustomReason('')
    setNote('')
    setNotifyUser(true)
  }

  const typeLabel: Record<string, string> = {
    story: 'truyện',
    chapter: 'chương',
    comment: 'bình luận',
  }

  return (
    <div
      id="moderation-action-modal-overlay"
      className="mod-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}
    >
      <div ref={containerRef} className="mod-modal" role="dialog" aria-modal="true" aria-labelledby="moderation-action-title" tabIndex={-1} aria-busy={isPending}>
        {/* Header */}
        <div className="mod-modal-header">
          <div className="mod-modal-title-row">
            <span className="mod-action-badge" style={{ background: `${actionMeta.color}20`, color: actionMeta.color }}>
              {actionMeta.label}
            </span>
            <h3 id="moderation-action-title" className="mod-modal-title">
              {actionMeta.label} {typeLabel[targetType] ?? targetType}
            </h3>
          </div>
          <button id="mod-modal-close-btn" className="mod-modal-close" onClick={onClose} disabled={isPending} aria-label="Đóng">
            ✕
          </button>
        </div>

        {/* Target Preview */}
        <div className="mod-modal-target">
          <span className="mod-modal-target-label">Đối tượng:</span>
          <span className="mod-modal-target-name">{targetTitle}</span>
        </div>

        <form onSubmit={handleSubmit} className="mod-modal-form">
          {/* Preset Reasons */}
          {presets.length > 0 && (
            <div className="mod-modal-field">
              <label className="mod-modal-label">Lý do vi phạm</label>
              <div className="mod-reason-list" role="group" aria-label="Lý do vi phạm">
                {presets.map((r) => (
                  <button
                    key={r}
                    type="button"
                    id={`mod-reason-${r.replace(/\s+/g, '-').toLowerCase()}`}
                    className={`mod-reason-chip${selectedReason === r ? ' active' : ''}`}
                    aria-pressed={selectedReason === r}
                    onClick={() => setSelectedReason(r)}
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  id="mod-reason-custom"
                  className={`mod-reason-chip${selectedReason === '__custom__' ? ' active' : ''}`}
                  aria-pressed={selectedReason === '__custom__'}
                  onClick={() => setSelectedReason('__custom__')}
                >
                  + Lý do khác
                </button>
              </div>
            </div>
          )}

          {/* Custom reason */}
          {selectedReason === '__custom__' && (
            <div className="mod-modal-field">
              <label className="mod-modal-label" htmlFor="mod-custom-reason">
                Lý do tùy chỉnh
              </label>
              <input
                id="mod-custom-reason"
                className="mod-modal-input"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Nhập lý do vi phạm..."
                autoFocus
              />
            </div>
          )}

          {/* Internal Note */}
          <div className="mod-modal-field">
            <label className="mod-modal-label" htmlFor="mod-note">
              Ghi chú nội bộ <span className="mod-modal-optional">(tuỳ chọn)</span>
            </label>
            <textarea
              id="mod-note"
              className="mod-modal-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú cho đội kiểm duyệt..."
              rows={3}
            />
          </div>

          {/* Notify User */}
          {action !== 'approve' && (
            <label className="mod-modal-checkbox-row" htmlFor="mod-notify-user">
              <input
                id="mod-notify-user"
                type="checkbox"
                checked={notifyUser}
                onChange={(e) => setNotifyUser(e.target.checked)}
                className="mod-modal-checkbox"
              />
              <span>Gửi thông báo cho tác giả / người dùng</span>
            </label>
          )}

          {/* Actions */}
          <div className="mod-modal-actions">
            <button
              id="mod-modal-cancel-btn"
              type="button"
              className="btn-mod-secondary"
              onClick={onClose}
              disabled={isPending}
            >
              Hủy
            </button>
            <button
              id="mod-modal-confirm-btn"
              type="submit"
              className="btn-mod-primary"
              style={{ background: actionMeta.color }}
              disabled={isPending}
            >
              {isPending ? 'Đang xử lý...' : `Xác nhận ${actionMeta.label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
