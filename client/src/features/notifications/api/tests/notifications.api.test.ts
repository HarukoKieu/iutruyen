import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchNotifications, fetchUnreadCount, markNotificationAsRead } from '../notifications.api'
import { api } from '@/lib/axios'

vi.mock('@/lib/axios', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('notifications.api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchNotifications', () => {
    it('correctly maps backend ApiResponse where data is an array and meta contains pagination', async () => {
      const mockNotifications = [
        { _id: 'n-1', title: 'Test 1', message: 'Msg 1', type: 'new_chapter', isRead: false },
      ]

      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: mockNotifications,
          meta: { nextCursor: 'cur-123', unreadCount: 5 },
        },
      })

      const res = await fetchNotifications()
      expect(res.notifications).toEqual(mockNotifications)
      expect(res.nextCursor).toBe('cur-123')
      expect(res.unreadCount).toBe(5)
    })

    it('handles legacy or mock format where data is an object containing notifications array', async () => {
      const mockNotifications = [
        { _id: 'n-2', title: 'Test 2', message: 'Msg 2', type: 'system', isRead: true },
      ]

      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            notifications: mockNotifications,
            nextCursor: 'cur-456',
            unreadCount: 1,
          },
        },
      })

      const res = await fetchNotifications()
      expect(res.notifications).toEqual(mockNotifications)
      expect(res.nextCursor).toBe('cur-456')
      expect(res.unreadCount).toBe(1)
    })

    it('returns empty array when data.data is unexpected', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: null,
        },
      })

      const res = await fetchNotifications()
      expect(res.notifications).toEqual([])
      expect(res.nextCursor).toBeNull()
      expect(res.unreadCount).toBe(0)
    })
  })

  describe('fetchUnreadCount', () => {
    it('returns unreadCount number', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: { unreadCount: 7 },
        },
      })

      const count = await fetchUnreadCount()
      expect(count).toBe(7)
    })
  })

  describe('markNotificationAsRead', () => {
    it('returns updated notification', async () => {
      const updatedNotif = { _id: 'n-1', isRead: true }
      vi.mocked(api.patch).mockResolvedValueOnce({
        data: {
          success: true,
          data: updatedNotif,
        },
      })

      const res = await markNotificationAsRead('n-1')
      expect(res).toEqual(updatedNotif)
      expect(api.patch).toHaveBeenCalledWith('/notifications/n-1/read')
    })
  })
})
