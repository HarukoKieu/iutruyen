import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'
import { useSubmitReport } from '../hooks/useModeration'
import type { CreateReportInput } from '@/types/moderation'
import { CHAPTER_REPORT_REASONS, CONTENT_REPORT_REASONS, OTHER_REPORT_REASON } from '../reportReasons'

interface Props {
  isOpen: boolean
  targetType: 'story' | 'chapter' | 'comment' | 'user'
  targetId: string
  targetTitle?: string
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  story: 'Truyện',
  chapter: 'Chương',
  comment: 'Bình luận',
  user: 'Người dùng',
}

export default function ReportModal(props: Props) {
  return props.isOpen ? <ReportModalContent key={`${props.targetType}:${props.targetId}`} {...props} /> : null
}

function ReportModalContent({ isOpen, targetType, targetId, targetTitle, onClose }: Props) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const submittingRef = useRef(false)
  const reasonOptions = [
    ...(targetType === 'chapter' ? CHAPTER_REPORT_REASONS : []),
    ...CONTENT_REPORT_REASONS,
    OTHER_REPORT_REASON,
  ]

  const submitMut = useSubmitReport()
  const containerRef = useRef<HTMLDivElement>(null)
  useModalAccessibility({ open: isOpen, onClose: () => handleClose(), containerRef })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason || submittingRef.current || submitted || (reason === 'other' && !description.trim())) return
    submittingRef.current = true

    const payload: CreateReportInput = {
      targetType,
      targetId,
      reason,
      description: description.trim() || undefined,
    }

    submitMut.mutate(payload, {
      onSuccess: () => {
        setSubmitted(true)
      },
      onSettled: () => { submittingRef.current = false },
    })
  }

  const handleClose = () => {
    if (submittingRef.current) return
    setReason('')
    setDescription('')
    setSubmitted(false)
    onClose()
  }

  return (
    <div
      id="report-modal-overlay"
      className="mod-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div ref={containerRef} className="mod-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title" tabIndex={-1}>
        <div className="mod-modal-header">
          <h3 className="mod-modal-title" id="report-modal-title">
            {targetType === 'chapter' ? 'Báo cáo vấn đề' : `Báo cáo ${TYPE_LABELS[targetType] ?? targetType}`}
          </h3>
          <button type="button" id="report-modal-close" className="mod-modal-close" onClick={handleClose} aria-label="Đóng" disabled={submitMut.isPending}>
            ✕
          </button>
        </div>

        {targetTitle && (
          <div className="mod-modal-target">
            <span className="mod-modal-target-label">Nội dung:</span>
            <span className="mod-modal-target-name">{targetTitle}</span>
          </div>
        )}

        {submitted ? (
          <div className="mod-report-success" role="status">
            <div className="mod-report-success-icon">✅</div>
            <div className="mod-report-success-title">Báo cáo đã được ghi nhận!</div>
            <p className="mod-report-success-desc">
              Cảm ơn bạn đã phản hồi. Chúng tôi sẽ xem xét vấn đề trong thời gian sớm nhất.
            </p>
            <button id="report-success-close" className="btn-mod-primary" onClick={handleClose}>
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mod-modal-form" id="report-modal-form" aria-busy={submitMut.isPending}>
            <div className="mod-modal-field">
              <label className="mod-modal-label">Lý do báo cáo <span className="required">*</span></label>
              <div className="mod-reason-list" role="group" aria-label="Lý do báo cáo">
                {reasonOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    id={`report-reason-${opt.value}`}
                    className={`mod-reason-chip${reason === opt.value ? ' active' : ''}`}
                    aria-pressed={reason === opt.value}
                    disabled={submitMut.isPending}
                    onClick={() => setReason(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mod-modal-field">
              <label className="mod-modal-label" htmlFor="report-description">
                Mô tả chi tiết {reason === 'other' ? <span className="required">*</span> : <span className="mod-modal-optional">(tuỳ chọn)</span>}
              </label>
              <textarea
                id="report-description"
                className="mod-modal-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={targetType === 'chapter' ? 'Mô tả vấn đề, đoạn văn bị lỗi hoặc nội dung cần sửa...' : 'Mô tả thêm về vi phạm bạn phát hiện...'}
                required={reason === 'other'}
                disabled={submitMut.isPending}
                aria-describedby="report-description-count"
                rows={3}
                maxLength={500}
              />
              <div id="report-description-count" className="mod-textarea-count">{description.length}/500</div>
            </div>

            {submitMut.isError && (
              <p role="alert" className="text-sm text-destructive">
                {(isAxiosError<{ message?: string }>(submitMut.error) && submitMut.error.response?.data?.message)
                  || 'Không thể gửi báo cáo. Vui lòng thử lại.'}
              </p>
            )}

            <div className="mod-modal-actions">
              <button
                id="report-cancel-btn"
                type="button"
                className="btn-mod-secondary"
                onClick={handleClose}
                disabled={submitMut.isPending}
              >
                Hủy
              </button>
              <button
                id="report-submit-btn"
                type="submit"
                className="btn-mod-primary"
                disabled={!reason || submitMut.isPending || (reason === 'other' && !description.trim())}
              >
                {submitMut.isPending ? 'Đang gửi...' : 'Gửi báo cáo'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
