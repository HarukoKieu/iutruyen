import { useInfiniteQuery } from '@tanstack/react-query'
import { chaptersApi } from '../api/chapters.api'
import { useAuthStore } from '@/features/auth/store/authStore'
export const useChapters = (storyId: string, options: { chapterId?: string; sort?: 'asc' | 'desc'; q?: string } = {}) => {
  const userId = useAuthStore(state => state.user?.id)
  const query = useInfiniteQuery({
    queryKey: ['chapters', storyId, userId || 'public', options],
    queryFn: ({ pageParam }) => chaptersApi.getChaptersByStory(storyId, { ...options, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.meta.hasMore ? page.meta.nextCursor : undefined,
    enabled: !!storyId,
  })
  return { ...query, data: query.data?.pages.flatMap(page => page.items) }
}
