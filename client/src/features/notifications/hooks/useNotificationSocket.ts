import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'
import { useAuthStore } from '@/features/auth/store/authStore'
import type { AppNotification } from '@/types/notification'
import { notificationKeys } from './useNotifications'

/**
 * Connects to the Socket.IO server when the user is authenticated and
 * listens for `notification:new` events.
 *
 * On each new notification:
 *  1. Invalidates React Query cache so the bell badge and lists refresh.
 *  2. Shows an interactive sonner toast with a link to the notification target.
 *
 * Must be called once at the app root (e.g. inside `Navbar`).
 */
export const useNotificationSocket = () => {
  const { isAuthenticated, accessToken } = useAuthStore()
  const qc = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocket()
      return
    }

    connectSocket()
    const socket = getSocket()

    {

      socket.on('connect', () => {
        // Refresh queries when we (re)connect in case we missed notifications
        void qc.invalidateQueries({ queryKey: notificationKeys.all })
      })

      socket.on('notification:new', (notification: AppNotification) => {
        // Update cache
        void qc.invalidateQueries({ queryKey: notificationKeys.all })

        // Toast with clickable navigation
        toast(notification.title, {
          description: notification.message,
          duration: 6000,
          action: notification.link
            ? {
                label: 'Xem ngay',
                onClick: () => navigate(notification.link ?? '/notifications'),
              }
            : undefined,
        })
      })

      socket.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message)
      })
    }

    return () => {
      socket.removeAllListeners()
      disconnectSocket()
    }
  }, [isAuthenticated, accessToken, qc, navigate])
}
