import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/features/auth/store/authStore'
import { moderationKeys } from './useModeration'

interface NewReportPayload {
  reportId?: string
  targetType?: string
  targetId?: string
  reason?: string
  createdAt?: string | Date
}

interface NewAuthorRequestPayload {
  userId?: string
  username?: string
  displayName?: string
  createdAt?: string | Date
}

interface QueueUpdatedPayload {
  type?: string
  action?: string
  reportId?: string
}

/**
 * Listens to moderation realtime socket events for Admins & Moderators.
 * 
 * Events:
 * - `moderation:new_report`: Triggered when any user submits a report
 * - `moderation:new_author_request`: Triggered when a user applies to become author
 * - `moderation:queue_updated`: Triggered when an item is reviewed/resolved
 */
export const useModerationSocket = () => {
  const { isAuthenticated, accessToken, user } = useAuthStore()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const canModerate = Boolean(
    isAuthenticated &&
    accessToken &&
    (user?.role === 'admin' || user?.role === 'moderator')
  )

  useEffect(() => {
    if (!canModerate) return

    const socket = getSocket()

    const handleNewReport = (payload: NewReportPayload) => {
      // Invalidate all moderation queries so summary badge and queues update immediately
      void qc.invalidateQueries({ queryKey: moderationKeys.all })

      const reasonText = payload.reason ? `: "${payload.reason}"` : ''
      toast.warning('Báo cáo nội dung mới', {
        description: `Có yêu cầu báo cáo vi phạm mới${reasonText}.`,
        duration: 8000,
        action: {
          label: 'Xem báo cáo',
          onClick: () => navigate('/mod/reports'),
        },
      })
    }

    const handleNewAuthorRequest = (payload: NewAuthorRequestPayload) => {
      void qc.invalidateQueries({ queryKey: ['admin'] })
      void qc.invalidateQueries({ queryKey: moderationKeys.summary() })

      const requester = payload.displayName || payload.username || 'Một độc giả'
      toast.info('Yêu cầu làm tác giả mới', {
        description: `${requester} vừa gửi yêu cầu đăng ký làm tác giả.`,
        duration: 8000,
        action: user?.role === 'admin'
          ? {
            label: 'Xem duyệt',
            onClick: () => navigate('/admin/users?authorStatus=pending'),
          }
          : undefined,
      })
    }

    const handleQueueUpdated = (_payload: QueueUpdatedPayload) => {
      void qc.invalidateQueries({ queryKey: moderationKeys.all })
    }

    socket.on('moderation:new_report', handleNewReport)
    socket.on('moderation:new_author_request', handleNewAuthorRequest)
    socket.on('moderation:queue_updated', handleQueueUpdated)

    return () => {
      socket.off('moderation:new_report', handleNewReport)
      socket.off('moderation:new_author_request', handleNewAuthorRequest)
      socket.off('moderation:queue_updated', handleQueueUpdated)
    }
  }, [canModerate, user?.role, qc, navigate])
}

