export type NotificationType =
  | 'new_chapter'
  | 'new_follow'
  | 'comment_reply'
  | 'comment_like'
  | 'system'

export interface AppNotification {
  _id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  isRead: boolean
  meta?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface NotificationsResponse {
  notifications: AppNotification[]
  nextCursor: string | null
  unreadCount: number
}
