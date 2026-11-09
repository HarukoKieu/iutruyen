import React, { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, MessageSquare, UserPlus, Bell, Trash2, Heart } from 'lucide-react'
import type { AppNotification, NotificationType } from '@/types/notification'
import { useMarkAsRead, useDeleteNotification } from '../hooks/useNotifications'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  new_chapter: { icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  comment_reply: { icon: MessageSquare, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  comment_like: { icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  new_follow: { icon: UserPlus, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  system: { icon: Bell, color: 'text-amber-500', bg: 'bg-amber-500/10' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'Vừa xong'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} ngày trước`
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: AppNotification
  /** If true, hide the delete button (e.g. inside compact popover). */
  compact?: boolean
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  compact = false,
}) => {
  const { mutate: markRead } = useMarkAsRead()
  const { mutate: deleteNoti, isPending: isDeleting } = useDeleteNotification()
  const navigate = useNavigate()
  const descriptionId = useId()

  const cfg = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.system
  const IconComponent = cfg.icon

  const handleClick = () => {
    if (!notification.isRead) markRead(notification._id)
    if (notification.link) navigate(notification.link)
  }

  return (
    <div
      className={`group flex items-start gap-1 rounded-xl transition-colors
        ${notification.isRead ? '' : 'bg-primary/5'} hover:bg-surface-raised`}
    >
      <button
        type="button"
        onClick={handleClick}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-xl px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={notification.title}
        aria-describedby={notification.isRead ? descriptionId : `${descriptionId} ${descriptionId}-unread`}
      >
        {/* Icon */}
        <span
          aria-hidden="true"
          className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full ${cfg.bg}`}
        >
          <IconComponent className={`h-4 w-4 ${cfg.color}`} />
        </span>

        {/* Content */}
        <span className="flex-1 min-w-0">
          <span
            id={`${descriptionId}-title`}
            className={`block break-words text-sm leading-snug ${compact ? 'line-clamp-2' : ''} ${notification.isRead ? 'text-foreground' : 'font-semibold text-foreground'}`}
          >
            {notification.title}
          </span>
          <span id={descriptionId} className={`mt-0.5 block break-words text-xs text-muted-foreground ${compact ? 'line-clamp-2' : ''}`}>
            {notification.message}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">{timeAgo(notification.createdAt)}</span>
          {!notification.isRead && <span id={`${descriptionId}-unread`} className="sr-only">Chưa đọc</span>}
        </span>

        {/* Unread dot */}
        {!notification.isRead && (
          <span aria-hidden="true" className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-primary" />
        )}
      </button>

      {/* Delete button */}
      {!compact && (
        <button
          type="button"
          onClick={() => deleteNoti(notification._id)}
          disabled={isDeleting}
          className="my-2 mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          aria-label="Xóa thông báo"
          aria-describedby={`${descriptionId}-title`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export default NotificationItem
