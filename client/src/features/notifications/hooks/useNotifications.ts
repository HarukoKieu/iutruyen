import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/features/auth/store/authStore'
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  type FetchNotificationsParams,
} from '../api/notifications.api'

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params: FetchNotificationsParams) => [...notificationKeys.lists(), params] as const,
  unreadCount: () => [...notificationKeys.all, 'unreadCount'] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Infinite-scroll paginated list of notifications.
 * Params: isRead, type, limit.
 */
export const useNotifications = (params: Omit<FetchNotificationsParams, 'cursor'> = {}) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  return useInfiniteQuery({
    queryKey: notificationKeys.list(params),
    queryFn: ({ pageParam }) =>
      fetchNotifications({ ...params, cursor: pageParam as string | undefined }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,
    enabled: isAuthenticated,
  })
}

/**
 * Simple list (first page only) — used by the NotificationBell popover.
 */
export const useRecentNotifications = (limit = 5) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  return useQuery({
    queryKey: notificationKeys.list({ limit }),
    queryFn: () => fetchNotifications({ limit }),
    staleTime: 30_000,
    enabled: isAuthenticated,
  })
}

/** Badge unread count. */
export const useUnreadCount = (enabled = true) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: fetchUnreadCount,
    staleTime: 30_000,
    refetchInterval: 60_000, // poll every minute as fallback
    enabled: enabled && isAuthenticated,
  })
}

/** Mutation: mark single notification read. */
export const useMarkAsRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

/** Mutation: mark all read. */
export const useMarkAllAsRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc')
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
    onError: () => {
      toast.error('Không thể đánh dấu tất cả đã đọc')
    },
  })
}

/** Mutation: delete notification. */
export const useDeleteNotification = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
    onError: () => {
      toast.error('Không thể xóa thông báo')
    },
  })
}
