import { Router } from 'express'
import { readingHistoryController } from './reading-history.controller.js'
import { upsertReadingHistorySchema } from './reading-history.validation.js'
import { validate } from '../../middlewares/validate.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { asyncHandler } from '../../common/asyncHandler.js'
import { personalListQuery } from '../../common/personalPagination.js'

const router = Router()

// AUTH: PUT /api/v1/reading-history (upsert)
router.put(
  '/',
  authenticate,
  validate({ body: upsertReadingHistorySchema }),
  asyncHandler(readingHistoryController.upsert)
)

// AUTH: GET /api/v1/users/me/reading-history
router.get(
  '/me',
  authenticate,
  validate({ query: personalListQuery }),
  asyncHandler(readingHistoryController.getUserHistory)
)

export default router
