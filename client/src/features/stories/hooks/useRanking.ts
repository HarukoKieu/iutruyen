import { useInfiniteQuery } from '@tanstack/react-query'
import { rankingApi } from '../api/ranking.api'
import type { RankingQueryParams } from '@/types/ranking'

export const useRanking = (params: Omit<RankingQueryParams, 'cursor'>) => {
  return useInfiniteQuery({
    queryKey: ['ranking', params],
    queryFn: ({ pageParam }) =>
      rankingApi.fetchRanking({ ...params, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.nextCursor ?? undefined) : undefined,
    staleTime: 1000 * 60 * 3, // 3 minutes
  })
}
