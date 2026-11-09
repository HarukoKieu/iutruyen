import { useQuery } from '@tanstack/react-query'
import { storiesApi } from '../api/stories.api'

export const useStory = (slug: string) => {
  return useQuery({
    queryKey: ['story', slug],
    queryFn: () => storiesApi.fetchStoryBySlug(slug),
    refetchOnMount: 'always',
    retry: false,
    enabled: !!slug,
  })
}

export const useStoryById = (id: string) => {
  return useQuery({
    queryKey: ['story-by-id', id],
    queryFn: () => storiesApi.fetchStoryById(id),
    enabled: !!id,
  })
}
