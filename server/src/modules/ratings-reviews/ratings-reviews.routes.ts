import { Router } from 'express'
import { ratingsReviewsController } from './ratings-reviews.controller.js'
import { authenticate, optionalAuthenticate } from '../../middlewares/authenticate.js'
import { validate } from '../../middlewares/validate.js'
import { rateLimit } from '../../middlewares/rateLimit.js'
import { asyncHandler } from '../../common/asyncHandler.js'
import {
  storyIdParamSchema,
  storyAndReviewIdParamSchema,
  upsertRatingSchema,
  upsertReviewSchema,
  queryReviewsSchema,
} from './ratings-reviews.validation.js'

const router = Router({ mergeParams: true })

const ratingRateLimiter = rateLimit({
  windowSeconds: 60,
  maxRequests: 10,
  prefix: 'rating',
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  message: 'Bạn đang đánh giá quá nhanh, vui lòng chờ một lát',
})

const reviewRateLimiter = rateLimit({
  windowSeconds: 60,
  maxRequests: 5,
  prefix: 'review',
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  message: 'Bạn đang gửi bài cảm nhận quá nhanh, vui lòng chờ một lát',
})

// ── RATINGS (per story) ──────────────────────────────────────────────────
// POST   /api/v1/stories/:storyId/ratings
router.post(
  '/ratings',
  authenticate,
  ratingRateLimiter,
  validate({ params: storyIdParamSchema, body: upsertRatingSchema }),
  asyncHandler(ratingsReviewsController.upsertRating)
)

// GET    /api/v1/stories/:storyId/ratings/me
router.get(
  '/ratings/me',
  authenticate,
  validate({ params: storyIdParamSchema }),
  asyncHandler(ratingsReviewsController.getMyRating)
)

// ── REVIEWS (per story) ──────────────────────────────────────────────────
// GET    /api/v1/stories/:storyId/reviews
router.get(
  '/reviews',
  optionalAuthenticate,
  validate({ params: storyIdParamSchema, query: queryReviewsSchema }),
  asyncHandler(ratingsReviewsController.getReviews)
)

// GET    /api/v1/stories/:storyId/reviews/me
router.get(
  '/reviews/me',
  authenticate,
  validate({ params: storyIdParamSchema }),
  asyncHandler(ratingsReviewsController.getMyReview)
)

// POST   /api/v1/stories/:storyId/reviews
router.post(
  '/reviews',
  authenticate,
  reviewRateLimiter,
  validate({ params: storyIdParamSchema, body: upsertReviewSchema }),
  asyncHandler(ratingsReviewsController.upsertReview)
)

// DELETE /api/v1/stories/:storyId/reviews/:reviewId
router.delete(
  '/reviews/:reviewId',
  authenticate,
  validate({ params: storyAndReviewIdParamSchema }),
  asyncHandler(ratingsReviewsController.deleteReview)
)

// POST   /api/v1/stories/:storyId/reviews/:reviewId/like
router.post(
  '/reviews/:reviewId/like',
  authenticate,
  validate({ params: storyAndReviewIdParamSchema }),
  asyncHandler(ratingsReviewsController.likeReview)
)

export default router
