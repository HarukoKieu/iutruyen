import { api } from '@/lib/axios'
import type { AppNotification, NotificationsResponse } from '@/types/notification'

export interface FetchNotificationsParams {
  isRead?: boolean
  type?: string
  cursor?: string
  limit?: number
}

export interface UnreadCountResponse {
  unreadCount: number
}

export const fetchNotifications = async (
  params: FetchNotificationsParams = {}
): Promise<NotificationsResponse> => {
  const { data } = await api.get<{
    success: boolean
    data: AppNotification[] | NotificationsResponse
    meta?: { nextCursor?: string | null; unreadCount?: number }
  }>('/notifications', { params })

  // When backend returns ApiResponse.success(res, notifications, { meta: { nextCursor, unreadCount } })
  if (Array.isArray(data.data)) {
    return {
      notifications: data.data,
      nextCursor: data.meta?.nextCursor ?? null,
      unreadCount: data.meta?.unreadCount ?? 0,
    }
  }

  // Fallback if backend or mock returns { notifications, nextCursor, unreadCount } in data
  if (data.data && Array.isArray((data.data as NotificationsResponse).notifications)) {
    return data.data as NotificationsResponse
  }

  return {
    notifications: [],
    nextCursor: null,
    unreadCount: 0,
  }
}

export const fetchUnreadCount = async (): Promise<number> => {
  const { data } = await api.get<{ success: boolean; data: UnreadCountResponse }>(
    '/notifications/unread-count'
  )
  return data.data.unreadCount
}

export const markNotificationAsRead = async (id: string): Promise<AppNotification> => {
  const { data } = await api.patch<{ success: boolean; data: AppNotification }>(
    `/notifications/${id}/read`
  )
  return data.data
}

export const markAllNotificationsAsRead = async (): Promise<{ modifiedCount: number }> => {
  const { data } = await api.patch<{ success: boolean; data: { modifiedCount: number } }>(
    '/notifications/read-all'
  )
  return data.data
}

export const deleteNotification = async (id: string): Promise<void> => {
  await api.delete(`/notifications/${id}`)
}
