import { Router } from 'express'
import { followsController } from './follows.controller.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { asyncHandler } from '../../common/asyncHandler.js'
import { validate } from '../../middlewares/validate.js'
import { z } from 'zod'
import { personalListQuery } from '../../common/personalPagination.js'

const router = Router()
const storyParams = z.object({ storyId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Story ID không hợp lệ') })
const listQuery = personalListQuery

// Follow / Unfollow toggle for a story
router.post('/stories/:storyId/follow', authenticate, validate({ params: storyParams }), asyncHandler(followsController.toggleFollow))

// Explicit DELETE unfollow (RESTful API docs/04 mục 10)
router.delete('/stories/:storyId/follow', authenticate, validate({ params: storyParams }), asyncHandler(followsController.unfollow))

// Check if current user is following a story
router.get('/stories/:storyId/follow/check', authenticate, validate({ params: storyParams }), asyncHandler(followsController.checkFollow))

// Get current user's followed stories (Tủ sách theo dõi)
router.get('/users/me/following', authenticate, validate({ query: listQuery }), asyncHandler(followsController.getUserFollows))

export default router
