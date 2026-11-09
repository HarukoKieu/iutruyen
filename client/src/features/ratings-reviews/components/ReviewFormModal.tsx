import React, { useState, useEffect } from 'react'
import { X, Send, AlertCircle, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'

interface ReviewFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (content: string) => Promise<void>
  initialContent?: string
  storyTitle: string
  isLoading?: boolean
}

export const ReviewFormModal: React.FC<ReviewFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialContent = '',
  storyTitle,
  isLoading = false,
}) => {
  const [content, setContent] = useState(initialContent)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  const contentId = React.useId()
  useModalAccessibility({ open: isOpen, onClose, containerRef: dialogRef })

  useEffect(() => {
    setContent(initialContent)
    setErrorMsg(null)
  }, [initialContent, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim().length < 50) {
      setErrorMsg('Bài cảm nhận cần có ít nhất 50 ký tự.')
      return
    }
    setErrorMsg(null)

    try {
      await onSubmit(content.trim())
      onClose()
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Không thể lưu bài cảm nhận.')
    }
  }

  const charCount = content.length
  const minChars = 50
  const maxChars = 3000

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-elevated space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen className="h-5 w-5 text-link" />
            <div className="min-w-0">
              <h2 id={titleId} className="font-serif text-base font-bold text-foreground">
                {initialContent ? 'Chỉnh Sửa Bài Cảm Nhận' : 'Viết Bài Cảm Nhận'}
              </h2>
              <p className="text-xs text-muted-foreground truncate max-w-sm">
                Tác phẩm: {storyTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bài cảm nhận"
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={contentId} className="text-xs font-semibold text-foreground">
              Chia sẻ góc nhìn & cảm nhận chi tiết của bạn:
            </label>
            <textarea
              id={contentId}
              aria-invalid={!!errorMsg}
              aria-describedby={errorMsg ? `${contentId}-error` : undefined}
              rows={6}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (errorMsg) setErrorMsg(null)
              }}
              placeholder="Bạn cảm thấy cốt truyện, tuyến nhân vật, văn phong của tác giả như thế nào? Điểm bạn thích hoặc chưa ưng ý? (Tối thiểu 50 ký tự)..."
              maxLength={maxChars}
              className="w-full rounded-2xl border border-border bg-surface-base p-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed font-serif"
            />
            <div className="flex items-center justify-between text-[11px]">
              <span className={charCount < minChars ? 'text-warning font-semibold' : 'text-success font-semibold'}>
                {charCount < minChars
                  ? `Cần thêm ít nhất ${minChars - charCount} ký tự`
                  : 'Đạt độ dài tối thiểu'}
              </span>
              <span className="text-muted-foreground">
                {charCount}/{maxChars}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div id={`${contentId}-error`} role="alert" className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-2.5 rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-full px-5"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={charCount < minChars || isLoading}
              isLoading={isLoading}
              className="rounded-full px-6 font-bold shadow-xs"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {initialContent ? 'Cập nhật cảm nhận' : 'Đăng cảm nhận'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
