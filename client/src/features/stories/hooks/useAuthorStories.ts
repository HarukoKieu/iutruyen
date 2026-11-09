import { useInfiniteQuery } from '@tanstack/react-query'
import { storiesApi } from '../api/stories.api'
import type { StoryQueryParams } from '@/types/story'

export const useAuthorStories = (params: Omit<StoryQueryParams, 'cursor'>) => {
  return useInfiniteQuery({
    queryKey: ['author-stories', params],
    queryFn: ({ pageParam }) =>
      storiesApi.fetchAuthorStories({ ...params, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.nextCursor ?? undefined) : undefined,
    staleTime: 1000 * 60 * 2,
  })
}
