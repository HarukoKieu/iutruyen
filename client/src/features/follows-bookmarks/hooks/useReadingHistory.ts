import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readingHistoryApi } from '../api/reading-history.api'
import { useAuthStore } from '@/features/auth/store/authStore'
import { usePersonalList } from './usePersonalList'

export const useUserReadingHistory = (limit: number = 20) => {
  return usePersonalList(['reading-history', 'me'], limit, readingHistoryApi.getPage)
}

export const useUpsertReadingHistory = () => {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuthStore()

  return useMutation({
    mutationFn: async ({
      storyId,
      lastChapterId,
      scrollPositionPercent,
    }: {
      storyId: string
      lastChapterId: string
      scrollPositionPercent?: number
    }) => {
      if (!isAuthenticated) return null
      return readingHistoryApi.upsertHistory(storyId, lastChapterId, scrollPositionPercent)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-history'] })
    },
  })
}
