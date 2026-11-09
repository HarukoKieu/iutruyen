import { useAuthStore } from '@/features/auth/store/authStore'
import { useQuery } from '@tanstack/react-query'
import { chaptersApi } from '../api/chapters.api'

export const useChapterDetail = (storySlug: string, chapterSlug: string) => {
  const userId = useAuthStore(state => state.user?.id)
  const hasHydrated = useAuthStore(state => state.hasHydrated)
  return useQuery({
    queryKey: ['chapter', storySlug, chapterSlug, userId || 'public'],
    queryFn: () => chaptersApi.getChapterBySlug(storySlug, chapterSlug),
    // Enabling after auth hydration must execute the client read, even with fresh SSR data.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled: hasHydrated && !!storySlug && !!chapterSlug,
  })
}
