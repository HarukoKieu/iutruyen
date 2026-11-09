import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import {
  searchStoriesApi,
  getSearchSuggestionsApi,
  getSearchHistoryApi,
  deleteSearchHistoryApi,
} from '../api/search.api'
import { useAuthStore } from '@/features/auth/store/authStore'
import type { SearchStoriesParams } from '@/types/search'

export const useSearchStories = (params: SearchStoriesParams) => {
  return useInfiniteQuery({
    queryKey: queryKeys.search.stories(params),
    queryFn: ({ pageParam }) =>
      searchStoriesApi({ ...params, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore && lastPage.meta.nextCursor
        ? lastPage.meta.nextCursor
        : undefined,
    staleTime: 30 * 1000,
  })
}

export const useSearchSuggestions = (q: string = '', enabled: boolean = true) => {
  const userId = useAuthStore(state => state.user?.id)
  return useQuery({
    queryKey: [...queryKeys.search.suggestions(q.trim()), userId || 'public'],
    queryFn: () => getSearchSuggestionsApi(q.trim()),
    staleTime: 60 * 1000,
    enabled,
  })
}

export const useSearchHistory = () => {
  const { isAuthenticated, user } = useAuthStore()
  return useQuery({
    queryKey: [...queryKeys.search.history, user?.id],
    queryFn: getSearchHistoryApi,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  })
}

export const useDeleteSearchHistory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (q?: string) => deleteSearchHistoryApi(q),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.search.history })
      queryClient.invalidateQueries({ queryKey: ['search', 'suggestions'] })
    },
  })
}
