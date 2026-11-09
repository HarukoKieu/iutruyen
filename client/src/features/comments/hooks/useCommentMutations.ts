import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commentsApi } from '../api/comments.api'

export const useCommentMutations = (storyId: string, chapterId?: string | null) => {
  const queryClient = useQueryClient()

  const invalidateComments = () => {
    queryClient.invalidateQueries({
      queryKey: ['comments', storyId],
    })
    queryClient.invalidateQueries({
      queryKey: ['replies'],
    })
  }

  const createCommentMutation = useMutation({
    mutationFn: (data: { content: string; parentId?: string | null }) =>
      commentsApi.createComment({
        storyId,
        chapterId: chapterId ?? null,
        parentId: data.parentId ?? null,
        content: data.content,
      }),
    onSuccess: () => {
      invalidateComments()
    },
  })

  const updateCommentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      commentsApi.updateComment(id, content),
    onSuccess: () => {
      invalidateComments()
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      commentsApi.deleteComment(id),
    onSuccess: () => {
      invalidateComments()
    },
  })

  const toggleLikeMutation = useMutation({
    mutationFn: (id: string) => commentsApi.toggleLike(id),
    onSuccess: () => {
      invalidateComments()
    },
  })

  const toggleLockMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      commentsApi.toggleLock(id),
    onSuccess: () => {
      invalidateComments()
    },
  })

  return {
    createComment: (content: string, parentId?: string | null) =>
      createCommentMutation.mutateAsync({ content, parentId }),
    isCreating: createCommentMutation.isPending,
    createError: createCommentMutation.error,
    updateComment: updateCommentMutation.mutateAsync,
    isUpdating: updateCommentMutation.isPending,
    deleteComment: deleteCommentMutation.mutateAsync,
    isDeleting: deleteCommentMutation.isPending,
    toggleLike: toggleLikeMutation.mutateAsync,
    toggleLock: toggleLockMutation.mutateAsync,
  }
}
