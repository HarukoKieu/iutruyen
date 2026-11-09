import { ratingRepository } from '../../repositories/rating.repository.js'
import { reviewRepository } from '../../repositories/review.repository.js'
import { storyRepository } from '../../repositories/story.repository.js'
import { AppError } from '../../common/AppError.js'
import { Types } from 'mongoose'
import type { UpsertRatingDto, UpsertReviewDto, QueryReviewsDto } from './ratings-reviews.validation.js'
import type { PopulatedReview } from '../../models/Review.model.js'

const assertStoryExists = async (storyId: string) => {
  if (!Types.ObjectId.isValid(storyId)) {
    throw new AppError(400, 'Story ID không hợp lệ')
  }
  const story = await storyRepository.findById(storyId)
  if (!story || story.moderationStatus !== 'approved') {
    throw new AppError(404, 'Truyện không tồn tại')
  }
}

export const ratingsReviewsService = {
  // ── RATINGS ──────────────────────────────────────────────────────────────
  async upsertRating(storyId: string, userId: string, dto: UpsertRatingDto) {
    await assertStoryExists(storyId)
    const rating = await ratingRepository.upsert(storyId, userId, dto.score)
    const updatedStory = await storyRepository.findById(storyId)
    return {
      rating: { storyId, userId, score: rating.score },
      storyStats: {
        ratingAverage: updatedStory?.ratingAverage ?? 0,
        ratingCount: updatedStory?.ratingCount ?? 0,
      },
    }
  },

  async getMyRating(storyId: string, userId: string) {
    if (!Types.ObjectId.isValid(storyId)) {
      throw new AppError(400, 'Story ID không hợp lệ')
    }
    const rating = await ratingRepository.findByUser(storyId, userId)
    return { score: rating?.score ?? null }
  },

  // ── REVIEWS ───────────────────────────────────────────────────────────────
  async upsertReview(storyId: string, userId: string, dto: UpsertReviewDto) {
    await assertStoryExists(storyId)
    const { review, isNew } = await reviewRepository.upsert(storyId, userId, dto.content)
    return { review, isNew }
  },

  async getReviews(
    storyId: string,
    dto: QueryReviewsDto,
    requestingUserId?: string
  ): Promise<{ items: PopulatedReview[]; hasMore: boolean; nextCursor: string | null }> {
    if (!Types.ObjectId.isValid(storyId)) {
      throw new AppError(400, 'Story ID không hợp lệ')
    }

    await assertStoryExists(storyId)
    const result = await reviewRepository.findManyPaginated(
      storyId,
      dto.sort as 'newest' | 'top',
      dto.cursor ?? null,
      dto.limit
    )

    const items: PopulatedReview[] = result.items.map((r) => ({
      ...r,
      likedByMe: requestingUserId
        ? (r.likedUserIds ?? []).some((uid) => uid.toString() === requestingUserId)
        : false,
      likedUserIds: undefined,
    }))

    return { items, hasMore: result.hasMore, nextCursor: result.nextCursor }
  },

  async getMyReview(storyId: string, userId: string) {
    if (!Types.ObjectId.isValid(storyId)) {
      throw new AppError(400, 'Story ID không hợp lệ')
    }
    const review = await reviewRepository.findByUser(storyId, userId)
    return { review: review ?? null }
  },

  async deleteReview(reviewId: string, userId: string, userRole: string) {
    if (!Types.ObjectId.isValid(reviewId)) {
      throw new AppError(400, 'Review ID không hợp lệ')
    }
    const review = await reviewRepository.findById(reviewId)
    if (!review || review.isDeleted) {
      throw new AppError(404, 'Bài cảm nhận không tồn tại')
    }

    const isOwner = review.userId.toString() === userId
    const isMod = ['moderator', 'admin'].includes(userRole)
    if (!isOwner && !isMod) {
      throw new AppError(403, 'Bạn không có quyền xóa bài cảm nhận này')
    }

    const deleted = await reviewRepository.softDelete(reviewId, review.userId)
    if (!deleted) throw AppError.notFound('Bài cảm nhận đã bị xóa hoặc thay đổi')
    return deleted
  },

  async likeReview(reviewId: string, userId: string) {
    if (!Types.ObjectId.isValid(reviewId)) {
      throw new AppError(400, 'Review ID không hợp lệ')
    }
    const updated = await reviewRepository.toggleLike(reviewId, userId)
    if (!updated) throw new AppError(404, 'Bài cảm nhận không tồn tại')
    return { likeCount: updated.likeCount }
  },
}
