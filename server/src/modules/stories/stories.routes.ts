import { Router, Request } from 'express'
import { storiesController } from './stories.controller.js'
import {
  createStorySchema,
  updateStorySchema,
  storyQuerySchema,
  rankingQuerySchema,
  authorStoriesQuerySchema,
  storyIdParamSchema,
} from './stories.validation.js'
import { validate } from '../../middlewares/validate.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireRole } from '../../middlewares/requireRole.js'
import { requireAuthorApproved } from '../../middlewares/requireAuthorApproved.js'
import { requireOwnership } from '../../middlewares/requireOwnership.js'
import { asyncHandler } from '../../common/asyncHandler.js'
import { storyRepository } from '../../repositories/story.repository.js'
import { AppError } from '../../common/AppError.js'
import { Types } from 'mongoose'
import { rateLimit } from '../../middlewares/rateLimit.js'

const router = Router()
const writeQuota = rateLimit({ prefix: 'story-write', windowSeconds: 60, maxRequests: 10, keyGenerator: req => req.user!.id })
router.get('/:id/cover', validate({ params: storyIdParamSchema }),
  rateLimit({ prefix: 'story-cover', windowSeconds: 60, maxRequests: 240 }),
  asyncHandler(storiesController.getPublicCover))

const getStoryAuthorId = async (req: Request): Promise<string> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const story = await storyRepository.findById(id)
  if (!story || story.moderationStatus === 'removed') {
    throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ', 'STORY_NOT_FOUND')
  }
  const author = story.authorId as { _id?: Types.ObjectId } | Types.ObjectId
  const authorId = '_id' in author && author._id ? author._id.toString() : author.toString()
  return authorId
}

// Public: Get stories with cursor pagination
router.get(
  '/',
  validate({ query: storyQuerySchema }),
  asyncHandler(storiesController.getStories)
)

// Public: Get ranking stories (cursor pagination)
router.get(
  '/ranking',
  validate({ query: rankingQuerySchema }),
  asyncHandler(storiesController.getRanking)
)

// Author: Get my stories
router.get(
  '/my-stories',
  authenticate,
  requireRole(['author', 'admin']),
  requireAuthorApproved,
  validate({ query: authorStoriesQuerySchema }),
  asyncHandler(storiesController.getAuthorStories)
)

// Author / Admin: Get story by ID (Protected per docs/04 AUTHOR:owner)
router.get(
  '/by-id/:id',
  authenticate,
  requireRole(['author', 'admin', 'moderator']),
  validate({ params: storyIdParamSchema }),
  requireOwnership(getStoryAuthorId),
  asyncHandler(storiesController.getStoryById)
)

// Public: Get story by slug
router.get('/:slug', asyncHandler(storiesController.getStoryBySlug))

// Author: Create story
router.post(
  '/',
  authenticate,
  requireRole(['author', 'admin']),
  requireAuthorApproved,
  validate({ body: createStorySchema }),
  writeQuota,
  asyncHandler(storiesController.createStory)
)

// Author: Update story
router.patch(
  '/:id',
  authenticate,
  requireRole(['author', 'admin']),
  requireAuthorApproved,
  validate({ params: storyIdParamSchema, body: updateStorySchema }),
  requireOwnership(getStoryAuthorId),
  writeQuota,
  asyncHandler(storiesController.updateStory)
)

// Author: Delete story
router.delete(
  '/:id',
  authenticate,
  requireRole(['author', 'admin']),
  requireAuthorApproved,
  validate({ params: storyIdParamSchema }),
  requireOwnership(getStoryAuthorId),
  asyncHandler(storiesController.deleteStory)
)

// Author: Get story stats
router.get(
  '/:id/stats',
  authenticate,
  requireRole(['author', 'admin']),
  requireAuthorApproved,
  validate({ params: storyIdParamSchema }),
  requireOwnership(getStoryAuthorId),
  asyncHandler(storiesController.getStoryStats)
)

export default router
