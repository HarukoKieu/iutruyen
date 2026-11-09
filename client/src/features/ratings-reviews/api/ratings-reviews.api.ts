import { axiosInstance } from '@/lib/axios'
import type {
  Review,
  ReviewListResult,
  RatingResult,
  UpsertRatingResponse,
} from '@/types/review'

export interface QueryReviewsParams {
  sort?: 'newest' | 'top'
  cursor?: string | null
  limit?: number
}

export const ratingsReviewsApi = {
  // ── RATINGS ──────────────────────────────────────────────────
  async getMyRating(storyId: string): Promise<RatingResult> {
    const res = await axiosInstance.get(`/stories/${storyId}/ratings/me`)
    return res.data.data
  },

  async upsertRating(storyId: string, score: number): Promise<UpsertRatingResponse> {
    const res = await axiosInstance.post(`/stories/${storyId}/ratings`, { score })
    return res.data.data
  },

  // ── REVIEWS ──────────────────────────────────────────────────
  async getReviews(storyId: string, params?: QueryReviewsParams): Promise<ReviewListResult> {
    const res = await axiosInstance.get(`/stories/${storyId}/reviews`, { params })
    return {
      items: res.data.data,
      hasMore: res.data.meta?.hasMore ?? false,
      nextCursor: res.data.meta?.nextCursor ?? null,
    }
  },

  async getMyReview(storyId: string): Promise<{ review: Review | null }> {
    const res = await axiosInstance.get(`/stories/${storyId}/reviews/me`)
    return res.data.data
  },

  async upsertReview(storyId: string, content: string): Promise<{ review: Review; isNew: boolean }> {
    const res = await axiosInstance.post(`/stories/${storyId}/reviews`, { content })
    return res.data.data
  },

  async deleteReview(storyId: string, reviewId: string): Promise<void> {
    await axiosInstance.delete(`/stories/${storyId}/reviews/${reviewId}`)
  },

  async toggleLikeReview(storyId: string, reviewId: string): Promise<{ likeCount: number }> {
    const res = await axiosInstance.post(`/stories/${storyId}/reviews/${reviewId}/like`)
    return res.data.data
  },
}
