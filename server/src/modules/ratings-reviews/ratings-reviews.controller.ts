import { Request, Response } from 'express'
import { ratingsReviewsService } from './ratings-reviews.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'
import type {
  UpsertRatingDto,
  UpsertReviewDto,
  QueryReviewsDto,
} from './ratings-reviews.validation.js'

export const ratingsReviewsController = {
  // ── RATINGS ────────────────────────────────────────────────────
  async upsertRating(req: Request, res: Response): Promise<void> {
    const storyId = String(req.params.storyId)
    const body = req.body as UpsertRatingDto
    const result = await ratingsReviewsService.upsertRating(storyId, req.user!.id, body)
    ApiResponse.success(res, result, { message: 'Đã cập nhật đánh giá sao' })
  },

  async getMyRating(req: Request, res: Response): Promise<void> {
    const storyId = String(req.params.storyId)
    const result = await ratingsReviewsService.getMyRating(storyId, req.user!.id)
    ApiResponse.success(res, result)
  },

  // ── REVIEWS ────────────────────────────────────────────────────
  async getReviews(req: Request, res: Response): Promise<void> {
    const storyId = String(req.params.storyId)
    const query = req.query as unknown as QueryReviewsDto
    const result = await ratingsReviewsService.getReviews(storyId, query, req.user?.id)
    ApiResponse.success(res, result.items, {
      meta: {
        limit: Number(query.limit) || 10,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    })
  },

  async getMyReview(req: Request, res: Response): Promise<void> {
    const storyId = String(req.params.storyId)
    const result = await ratingsReviewsService.getMyReview(storyId, req.user!.id)
    ApiResponse.success(res, result)
  },

  async upsertReview(req: Request, res: Response): Promise<void> {
    const storyId = String(req.params.storyId)
    const body = req.body as UpsertReviewDto
    const result = await ratingsReviewsService.upsertReview(storyId, req.user!.id, body)
    ApiResponse.success(res, result, {
      statusCode: result.isNew ? 201 : 200,
      message: result.isNew ? 'Đã đăng bài cảm nhận' : 'Đã cập nhật bài cảm nhận',
    })
  },

  async deleteReview(req: Request, res: Response): Promise<void> {
    await ratingsReviewsService.deleteReview(String(req.params.reviewId), req.user!.id, req.user!.role)
    ApiResponse.success(res, null, { message: 'Đã xóa bài cảm nhận' })
  },

  async likeReview(req: Request, res: Response): Promise<void> {
    const result = await ratingsReviewsService.likeReview(String(req.params.reviewId), req.user!.id)
    ApiResponse.success(res, result, { message: 'Cập nhật lượt thích thành công' })
  },
}
