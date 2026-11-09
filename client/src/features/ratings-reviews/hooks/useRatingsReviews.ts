import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { ratingsReviewsApi } from '../api/ratings-reviews.api'
import type { QueryReviewsParams } from '../api/ratings-reviews.api'

export const useMyRating = (storyId: string, enabled = true) => {
  return useQuery({
    queryKey: ['my-rating', storyId],
    queryFn: () => ratingsReviewsApi.getMyRating(storyId),
    enabled: Boolean(storyId) && enabled,
    staleTime: 1000 * 60 * 5,
  })
}

export const useRatingMutation = (storyId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (score: number) => ratingsReviewsApi.upsertRating(storyId, score),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-rating', storyId] })
      queryClient.invalidateQueries({ queryKey: ['story'] })
      queryClient.invalidateQueries({ queryKey: ['stories'] })
    },
  })
}

export const useReviews = (storyId: string, params?: Omit<QueryReviewsParams, 'cursor'>) => {
  return useInfiniteQuery({
    queryKey: ['reviews', storyId, params?.sort],
    queryFn: ({ pageParam }) =>
      ratingsReviewsApi.getReviews(storyId, {
        ...params,
        cursor: pageParam as string | null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 1000 * 60,
    enabled: Boolean(storyId),
  })
}

export const useMyReview = (storyId: string, enabled = true) => {
  return useQuery({
    queryKey: ['my-review', storyId],
    queryFn: () => ratingsReviewsApi.getMyReview(storyId),
    enabled: Boolean(storyId) && enabled,
    staleTime: 1000 * 60 * 2,
  })
}

export const useReviewMutations = (storyId: string) => {
  const queryClient = useQueryClient()

  const invalidateReviews = () => {
    queryClient.invalidateQueries({ queryKey: ['reviews', storyId] })
    queryClient.invalidateQueries({ queryKey: ['my-review', storyId] })
  }

  const upsertReviewMutation = useMutation({
    mutationFn: (content: string) => ratingsReviewsApi.upsertReview(storyId, content),
    onSuccess: () => invalidateReviews(),
  })

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: string) => ratingsReviewsApi.deleteReview(storyId, reviewId),
    onSuccess: () => invalidateReviews(),
  })

  const toggleLikeReviewMutation = useMutation({
    mutationFn: (reviewId: string) => ratingsReviewsApi.toggleLikeReview(storyId, reviewId),
    onSuccess: () => invalidateReviews(),
  })

  return {
    upsertReview: upsertReviewMutation.mutateAsync,
    isUpserting: upsertReviewMutation.isPending,
    deleteReview: deleteReviewMutation.mutateAsync,
    isDeleting: deleteReviewMutation.isPending,
    toggleLikeReview: toggleLikeReviewMutation.mutateAsync,
  }
}
