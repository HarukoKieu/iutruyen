import React, { useState } from 'react'
import { Bell, CheckCheck, BookOpen, MessageSquare, UserPlus, LayoutList, Heart } from 'lucide-react'
import { useNotifications, useMarkAllAsRead, useUnreadCount } from '../hooks/useNotifications'
import { NotificationItem } from '../components/NotificationItem'
import type { AppNotification, NotificationType } from '@/types/notification'
import { useAuthStore } from '@/features/auth/store/authStore'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

// ─── Tab Config ───────────────────────────────────────────────────────────────

type TabId = 'all' | 'unread' | 'new_chapter' | 'comment_reply' | 'comment_like' | 'new_follow' | 'system'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'Tất cả', icon: LayoutList },
  { id: 'unread', label: 'Chưa đọc', icon: Bell },
  { id: 'new_chapter', label: 'Chương mới', icon: BookOpen },
  { id: 'comment_reply', label: 'Phản hồi', icon: MessageSquare },
  { id: 'comment_like', label: 'Lượt thích', icon: Heart },
  { id: 'new_follow', label: 'Theo dõi', icon: UserPlus },
]

// ─── Component ────────────────────────────────────────────────────────────────

const NotificationPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabId>('all')
  const { mutate: markAll, isPending: markingAll } = useMarkAllAsRead()
  const { data: unreadCount = 0 } = useUnreadCount(isAuthenticated)

  // Build query params from tab — must be computed before any hooks
  const params: { isRead?: boolean; type?: NotificationType } = {}
  if (activeTab === 'unread') params.isRead = false
  else if (activeTab !== 'all') params.type = activeTab as NotificationType

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    isFetchNextPageError,
    refetch,
    isFetching,
  } = useNotifications(params)

  const allNotifications =
    data?.pages
      .flatMap((p) => (Array.isArray(p?.notifications) ? p.notifications : []))
      .filter((n): n is AppNotification => Boolean(n && typeof n === 'object' && n._id)) ?? []

  // Guard AFTER all hooks
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <Link to="/" className="mb-5 inline-flex min-h-9 items-center rounded-md text-sm text-muted-foreground hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          ← Về trang chủ
        </Link>
        {/* Page Header */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Thông báo</h1>
            {unreadCount > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Bạn có{' '}
                <span className="font-semibold text-link">{unreadCount}</span> thông báo chưa đọc
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              id="mark-all-read-btn"
              onClick={() => markAll()}
              disabled={markingAll}
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:border-primary/50 hover:text-link transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>

        {/* Tabs */}
        <div role="group" aria-label="Lọc thông báo" className="mb-4 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {TABS.map((tab) => {
            const IconComponent = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                id={`notification-tab-${tab.id}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={isActive}
                className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                  ${isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
                  }`}
              >
                <IconComponent className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* List */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div role="status" className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Đang tải thông báo…</p>
            </div>
          ) : isError && allNotifications.length === 0 ? (
            <div role="alert" className="space-y-3 px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">Không thể tải thông báo. Vui lòng thử lại.</p>
              <Button type="button" variant="outline" onClick={() => void refetch()} isLoading={isFetching}>Thử lại</Button>
            </div>
          ) : allNotifications.length === 0 ? (
            <EmptyState tabId={activeTab} />
          ) : (
            <>
              <div className="divide-y divide-border">
                {allNotifications.map((n) => (
                  <NotificationItem key={n._id} notification={n} />
                ))}
              </div>

              {/* Load more */}
              {(hasNextPage || isFetchNextPageError) && (
                <div className="border-t border-border px-4 py-3 text-center">
                  {isFetchNextPageError && <p role="alert" className="mb-2 text-xs text-destructive">Không thể tải thêm thông báo. Vui lòng thử lại.</p>}
                  <button
                    type="button"
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="min-h-10 rounded-lg px-3 text-xs font-medium text-link hover:text-link/80 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {isFetchingNextPage ? 'Đang tải…' : 'Tải thêm thông báo'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

const EMPTY_MESSAGES: Record<TabId, { title: string; desc: string }> = {
  all: { title: 'Chưa có thông báo', desc: 'Hãy theo dõi truyện yêu thích để nhận thông báo khi có chương mới.' },
  unread: { title: 'Bạn đã đọc hết rồi!', desc: 'Tuyệt vời — tất cả thông báo đã được xem.' },
  new_chapter: { title: 'Chưa có chương mới', desc: 'Theo dõi thêm truyện để được thông báo khi tác giả cập nhật.' },
  comment_reply: { title: 'Chưa có phản hồi', desc: 'Bình luận và tương tác với cộng đồng để nhận thông báo.' },
  comment_like: { title: 'Chưa có lượt thích nào', desc: 'Các thông báo khi có người thích bình luận của bạn sẽ xuất hiện tại đây.' },
  new_follow: { title: 'Chưa có người theo dõi', desc: 'Chia sẻ tác phẩm của bạn để thu hút độc giả.' },
  system: { title: 'Không có thông báo hệ thống', desc: 'Các thông báo quan trọng từ iutruyen sẽ xuất hiện tại đây.' },
}

const EmptyState: React.FC<{ tabId: TabId }> = ({ tabId }) => {
  const msg = EMPTY_MESSAGES[tabId]
  return (
    <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <Bell className="h-6 w-6 text-link/60" />
      </div>
      <h2 className="font-semibold text-foreground">{msg.title}</h2>
      <p className="text-sm text-muted-foreground max-w-xs">{msg.desc}</p>
    </div>
  )
}

export default NotificationPage
