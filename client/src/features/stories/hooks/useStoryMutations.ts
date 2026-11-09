import { useMutation, useQueryClient } from '@tanstack/react-query'
import { storiesApi } from '../api/stories.api'
import type { CreateStoryInput, UpdateStoryInput } from '@/types/story'

export const useCreateStory = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStoryInput) => storiesApi.createStory(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] })
      queryClient.invalidateQueries({ queryKey: ['author-stories'] })
    },
  })
}

export const useUpdateStory = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStoryInput }) =>
      storiesApi.updateStory(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stories'] })
      queryClient.invalidateQueries({ queryKey: ['author-stories'] })
      if (data?._id) {
        queryClient.invalidateQueries({ queryKey: ['story-by-id', data._id] })
      }
      if (data?.slug) {
        queryClient.invalidateQueries({ queryKey: ['story', data.slug] })
      }
    },
  })
}

export const useDeleteStory = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => storiesApi.deleteStory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] })
      queryClient.invalidateQueries({ queryKey: ['author-stories'] })
    },
  })
}
