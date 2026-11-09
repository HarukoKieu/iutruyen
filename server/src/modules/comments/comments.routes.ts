import { Router } from 'express'
import { commentsController } from './comments.controller.js'
import { authenticate, optionalAuthenticate } from '../../middlewares/authenticate.js'
import { validate } from '../../middlewares/validate.js'
import { rateLimit } from '../../middlewares/rateLimit.js'
import { asyncHandler } from '../../common/asyncHandler.js'
import {
  commentIdParamSchema,
  createCommentSchema,
  updateCommentSchema,
  queryCommentsSchema,
  queryRepliesSchema,
} from './comments.validation.js'

const router = Router()

// Rate limiter for creating comments (10 comments per 60s per user)
const commentRateLimiter = rateLimit({
  windowSeconds: 60,
  maxRequests: 10,
  prefix: 'comment',
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  message: 'Bạn đang gửi bình luận quá nhanh, vui lòng chờ một lát',
})

// GET /api/v1/comments?storyId=&chapterId=&sort=newest&cursor=&limit=20
router.get(
  '/',
  optionalAuthenticate,
  validate({ query: queryCommentsSchema }),
  asyncHandler(commentsController.getComments)
)

// GET /api/v1/comments/:id/replies?cursor=&limit=10
router.get(
  '/:id/replies',
  optionalAuthenticate,
  validate({ params: commentIdParamSchema, query: queryRepliesSchema }),
  asyncHandler(commentsController.getReplies)
)

// POST /api/v1/comments
router.post(
  '/',
  authenticate,
  commentRateLimiter,
  validate({ body: createCommentSchema }),
  asyncHandler(commentsController.createComment)
)

// PATCH /api/v1/comments/:id
router.patch(
  '/:id',
  authenticate,
  validate({ params: commentIdParamSchema, body: updateCommentSchema }),
  asyncHandler(commentsController.updateComment)
)

// DELETE /api/v1/comments/:id
router.delete(
  '/:id',
  authenticate,
  validate({ params: commentIdParamSchema }),
  asyncHandler(commentsController.deleteComment)
)

// POST /api/v1/comments/:id/like (toggle)
router.post(
  '/:id/like',
  authenticate,
  validate({ params: commentIdParamSchema }),
  asyncHandler(commentsController.likeComment)
)

// PATCH /api/v1/comments/:id/lock (toggle — story author / mod / admin)
router.patch(
  '/:id/lock',
  authenticate,
  validate({ params: commentIdParamSchema }),
  asyncHandler(commentsController.lockComment)
)

export default router
