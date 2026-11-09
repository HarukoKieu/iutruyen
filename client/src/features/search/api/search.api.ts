import { api } from '@/lib/axios'
import type { Story, CursorPaginationMeta } from '@/types/story'
import type {
  SearchStoriesParams,
  SearchSuggestionsResponse,
  SearchHistoryItem,
} from '@/types/search'

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  meta?: CursorPaginationMeta
}

export const searchStoriesApi = async (
  params: SearchStoriesParams
): Promise<{ stories: Story[]; meta: CursorPaginationMeta }> => {
  const { data } = await api.get<ApiResponse<Story[]>>('/search/stories', {
    params,
  })
  return {
    stories: data.data || [],
    meta: data.meta || { limit: params.limit || 20, nextCursor: null, hasMore: false },
  }
}

export const getSearchSuggestionsApi = async (
  q: string = ''
): Promise<SearchSuggestionsResponse> => {
  const { data } = await api.get<ApiResponse<SearchSuggestionsResponse>>(
    '/search/suggestions',
    {
      params: { q },
    }
  )
  return (
    data.data || {
      history: [],
      suggestions: [],
      stories: [],
      trending: [],
    }
  )
}

export const getSearchHistoryApi = async (): Promise<SearchHistoryItem[]> => {
  const { data } = await api.get<ApiResponse<SearchHistoryItem[]>>(
    '/users/me/search-history'
  )
  return data.data || []
}

export const deleteSearchHistoryApi = async (
  q?: string
): Promise<{ success: boolean; message: string }> => {
  const { data } = await api.delete<ApiResponse<{ success: boolean; message: string }>>(
    '/users/me/search-history',
    {
      params: q ? { q } : undefined,
    }
  )
  return data.data || { success: true, message: data.message || 'Thành công' }
}

export const searchApi = {
  searchStories: searchStoriesApi,
  getSuggestions: getSearchSuggestionsApi,
  getSearchHistory: getSearchHistoryApi,
  deleteSearchHistory: deleteSearchHistoryApi,
}
