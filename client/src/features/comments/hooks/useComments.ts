import { useInfiniteQuery } from '@tanstack/react-query'
import { commentsApi } from '../api/comments.api'
import type { QueryCommentsParams } from '../api/comments.api'

export const useComments = (params: Omit<QueryCommentsParams, 'cursor'>) => {
  return useInfiniteQuery({
    queryKey: ['comments', params.storyId, params.chapterId, params.sort],
    queryFn: ({ pageParam }) =>
      commentsApi.getComments({
        ...params,
        cursor: pageParam as string | null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 1000 * 30, // 30s
    enabled: Boolean(params.storyId),
  })
}

export const useReplies = (commentId: string, enabled = false) => {
  return useInfiniteQuery({
    queryKey: ['replies', commentId],
    queryFn: ({ pageParam }) =>
      commentsApi.getReplies(commentId, {
        cursor: pageParam as string | null,
        limit: 10,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 1000 * 30,
    enabled: Boolean(commentId) && enabled,
  })
}
