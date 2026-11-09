import { useQuery } from '@tanstack/react-query'
import { tagsApi } from '../api/tags.api'

export const useTags = (q?: string) => {
  return useQuery({
    queryKey: ['tags', q],
    queryFn: () => tagsApi.fetchTags(q),
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}
