import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { bookmarksApi } from '../api/bookmarks.api'

import { useAuthStore } from '@/features/auth/store/authStore'
import { usePersonalList } from './usePersonalList'

export const useUserBookmarks = () => {
  return usePersonalList(['bookmarks', 'me'], 50, bookmarksApi.getPage)
}

export const useCheckBookmark = (chapterId: string) => {
  const { isAuthenticated } = useAuthStore()
  return useQuery({
    queryKey: ['bookmark', 'check', chapterId],
    queryFn: () => bookmarksApi.checkBookmark(chapterId),
    enabled: !!chapterId && isAuthenticated,
  })
}

export const useToggleBookmark = (chapterId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      isBookmarked,
      bookmarkId,
      note,
    }: {
      isBookmarked: boolean
      bookmarkId?: string
      note?: string
    }) => {
      if (isBookmarked && bookmarkId) {
        await bookmarksApi.deleteBookmark(bookmarkId)
        return { action: 'deleted' as const }
      } else {
        const bookmark = await bookmarksApi.createBookmark(chapterId, note)
        return { action: 'created' as const, bookmark }
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bookmark', 'check', chapterId] })
      queryClient.invalidateQueries({ queryKey: ['bookmarks', 'me'] })
      if (result.action === 'created') {
        toast.success('Đã lưu dấu trang')
      } else {
        toast.success('Đã bỏ dấu trang')
      }
    },
    onError: () => {
      toast.error('Có lỗi xảy ra khi lưu dấu trang')
    },
  })
}
