import { useInfiniteQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import type { PersonalPage } from '../api/personal-page'

export function usePersonalList<T>(key: string[], limit: number, fetch: (limit: number, cursor: string | null) => Promise<PersonalPage<T>>) {
  const { user, isAuthenticated } = useAuthStore()
  const query = useInfiniteQuery({
    queryKey: [...key, user?.id, limit],
    queryFn: ({ pageParam }) => fetch(limit, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: isAuthenticated,
    staleTime: 120000,
  })
  return { ...query, data: query.data?.pages.flatMap(page => page.items) }
}
