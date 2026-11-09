import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck, X } from 'lucide-react'
import { useUnreadCount, useRecentNotifications, useMarkAllAsRead } from '../hooks/useNotifications'
import { NotificationItem } from './NotificationItem'
import { useAuthStore } from '@/features/auth/store/authStore'
import type { AppNotification } from '@/types/notification'
import { cn } from '@/lib/utils'

export const NotificationBell: React.FC<{ panelClassName?: string }> = ({ panelClassName }) => {
  const { isAuthenticated } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const { data: unreadCount = 0 } = useUnreadCount(isAuthenticated)
  const { data: recentData, isLoading, isError, refetch, isFetching } = useRecentNotifications(5)
  const { mutate: markAll, isPending: markingAll } = useMarkAllAsRead()

  // Close on outside click / Escape
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

  if (!isAuthenticated) return null

  const notifications = (
    Array.isArray(recentData?.notifications) ? recentData.notifications : []
  ).filter((n): n is AppNotification => Boolean(n && typeof n === 'object' && n._id))
  const displayCount = unreadCount > 99 ? '99+' : unreadCount

  return (
    <div ref={panelRef} className="relative" onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
    }}>
      {/* Bell trigger */}
      <button
        id="notification-bell-btn"
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label={`Thông báo${unreadCount > 0 ? ` — ${unreadCount} chưa đọc` : ''}`}
        aria-haspopup="dialog"
        aria-controls={isOpen ? 'notification-panel' : undefined}
        aria-expanded={isOpen}
        className="relative flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-link hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground leading-none">
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          id="notification-panel"
          role="dialog"
          aria-label="Thông báo"
          className={cn("fixed left-3 right-3 top-16 mt-2 flex max-h-[calc(100dvh-6rem)] flex-col sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-80 rounded-2xl border border-border bg-card shadow-card z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150", panelClassName)}
        >
          {/* Header */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Thông báo</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAll()}
                  disabled={markingAll}
                  className="flex min-h-9 items-center gap-1 text-xs text-muted-foreground hover:text-link px-2 py-1 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Đánh dấu đã đọc</span>
                </button>
              )}
              <button
                type="button"
                ref={closeRef}
                onClick={() => {
                  setIsOpen(false)
                  triggerRef.current?.focus()
                }}
                className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Đóng"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="min-h-0 max-h-96 overflow-y-auto overscroll-contain">
            {isLoading ? (
              <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <div aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Đang tải thông báo…</span>
              </div>
            ) : isError ? (
              <div role="alert" className="space-y-2 px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">Không thể tải thông báo.</p>
                <button type="button" onClick={() => void refetch()} disabled={isFetching} className="min-h-10 rounded-lg px-3 text-sm text-link hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                  {isFetching ? 'Đang tải…' : 'Thử lại'}
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">Chưa có thông báo nào</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {notifications.map((n) => (
                  <NotificationItem key={n._id} notification={n} compact />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border px-4 py-2.5">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex min-h-9 items-center justify-center rounded-lg text-center text-xs font-medium text-link hover:text-link/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Xem tất cả thông báo →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
