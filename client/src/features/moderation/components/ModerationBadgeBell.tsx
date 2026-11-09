import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, ShieldCheck, ArrowRight, X } from 'lucide-react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useModerationSummary } from '../hooks/useModeration'
import { cn } from '@/lib/utils'

export const ModerationBadgeBell: React.FC<{ panelClassName?: string }> = ({ panelClassName }) => {
  const { user, isAuthenticated } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const canModerate = Boolean(
    isAuthenticated && (user?.role === 'admin' || user?.role === 'moderator')
  )

  const { data: summary, isLoading } = useModerationSummary()

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return
    closeRef.current?.focus()
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen])

  if (!canModerate) return null

  const totalPending = summary?.totalPending ?? 0
  const pendingReports = summary?.pendingReports ?? 0
  const pendingStories = summary?.pendingStories ?? 0
  const pendingChapters = summary?.pendingChapters ?? 0
  const spamComments = summary?.spamComments ?? 0

  const displayCount = totalPending > 99 ? '99+' : totalPending
  const hasPending = totalPending > 0

  return (
    <div
      ref={panelRef}
      className="relative"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
      }}
    >
      {/* Moderation trigger button */}
      <button
        id="moderation-bell-btn"
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label={`Kiểm duyệt${hasPending ? ` — ${totalPending} việc cần duyệt` : ''}`}
        aria-haspopup="dialog"
        aria-controls={isOpen ? 'moderation-panel' : undefined}
        aria-expanded={isOpen}
        title={hasPending ? `Kiểm duyệt: ${totalPending} mục đang chờ duyệt` : 'Bảng kiểm duyệt'}
        className={cn(
          'relative flex items-center justify-center h-9 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          hasPending
            ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-500/10'
            : 'text-muted-foreground hover:text-link hover:bg-secondary'
        )}
      >
        {hasPending ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        {hasPending && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white leading-none',
              pendingReports > 0 ? 'bg-destructive' : 'bg-amber-600'
            )}
          >
            {displayCount}
          </span>
        )}
      </button>

      {/* Moderation Dropdown panel */}
      {isOpen && (
        <div
          id="moderation-panel"
          role="dialog"
          aria-label="Hàng đợi kiểm duyệt"
          className={cn(
            'fixed left-3 right-3 top-16 mt-2 flex max-h-[calc(100dvh-6rem)] flex-col sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-80 rounded-2xl border border-border bg-card shadow-card z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150',
            panelClassName
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 bg-muted/40">
            <div className="flex items-center gap-2">
              <span className="text-base">🛡️</span>
              <div>
                <span className="text-sm font-semibold text-foreground">Hàng đợi kiểm duyệt</span>
                <p className="text-[11px] text-muted-foreground">
                  {totalPending > 0
                    ? `${totalPending} mục đang chờ xử lý`
                    : 'Tất cả nội dung đã được xử lý'}
                </p>
              </div>
            </div>
            <button
              type="button"
              ref={closeRef}
              onClick={() => {
                setIsOpen(false)
                triggerRef.current?.focus()
              }}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* List queue items */}
          <div className="p-3 space-y-1.5 text-xs">
            {isLoading ? (
              <div className="py-6 text-center text-muted-foreground">Đang tải số liệu…</div>
            ) : (
              <>
                {/* 1. Reports */}
                <Link
                  to="/mod/reports"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-secondary transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🚨</span>
                    <div>
                      <div className="font-semibold text-foreground group-hover:text-link">
                        Báo cáo từ độc giả
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Khiếu nại, vi phạm bản quyền, lỗi
                      </div>
                    </div>
                  </div>
                  {pendingReports > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-destructive/15 text-destructive">
                      {pendingReports}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">0</span>
                  )}
                </Link>

                {/* 2. Story Queue */}
                <Link
                  to="/mod/stories"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-secondary transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📚</span>
                    <div>
                      <div className="font-semibold text-foreground group-hover:text-link">
                        Truyện mới chờ duyệt
                      </div>
                      <div className="text-[11px] text-muted-foreground">Tác phẩm mới gửi lên</div>
                    </div>
                  </div>
                  {pendingStories > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600">
                      {pendingStories}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">0</span>
                  )}
                </Link>

                {/* 3. Chapter Queue */}
                <Link
                  to="/mod/chapters"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-secondary transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📄</span>
                    <div>
                      <div className="font-semibold text-foreground group-hover:text-link">
                        Chương mới chờ duyệt
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Nội dung chương cần phê duyệt
                      </div>
                    </div>
                  </div>
                  {pendingChapters > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600">
                      {pendingChapters}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">0</span>
                  )}
                </Link>

                {/* 4. Spam Comments */}
                <Link
                  to="/mod/comments"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-secondary transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">💬</span>
                    <div>
                      <div className="font-semibold text-foreground group-hover:text-link">
                        Bình luận nghi spam
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Bị bot phát hiện hoặc bị khóa
                      </div>
                    </div>
                  </div>
                  {spamComments > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600">
                      {spamComments}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">0</span>
                  )}
                </Link>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-2 bg-muted/20">
            <Link
              to="/mod/chapters"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg text-xs font-semibold text-link hover:bg-secondary transition-colors"
            >
              <span>Vào trang kiểm duyệt đầy đủ</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
export default ModerationBadgeBell

