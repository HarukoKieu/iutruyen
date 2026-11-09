import { Router } from 'express'
import { bookmarksController } from './bookmarks.controller.js'
import { createBookmarkSchema } from './bookmarks.validation.js'
import { validate } from '../../middlewares/validate.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { asyncHandler } from '../../common/asyncHandler.js'
import { rateLimit } from '../../middlewares/rateLimit.js'
import { personalListQuery } from '../../common/personalPagination.js'

const bookmarkWriteLimit = rateLimit({
  windowSeconds: 60,
  maxRequests: 10,
  prefix: 'bookmark_write',
  message: 'Bạn đang thạo tác bookmark quá nhanh, vui lòng thử lại sau',
})

const router = Router()

// AUTH: POST /api/v1/bookmarks
router.post(
  '/',
  authenticate,
  bookmarkWriteLimit,
  validate({ body: createBookmarkSchema }),
  asyncHandler(bookmarksController.createBookmark)
)

// AUTH: GET /api/v1/users/me/bookmarks (or /api/v1/bookmarks/me)
router.get(
  '/me',
  authenticate,
  validate({ query: personalListQuery }),
  asyncHandler(bookmarksController.getUserBookmarks)
)

// AUTH: GET /api/v1/bookmarks/check/:chapterId
router.get(
  '/check/:chapterId',
  authenticate,
  asyncHandler(bookmarksController.checkBookmark)
)

// AUTH: DELETE /api/v1/bookmarks/:id
router.delete(
  '/:id',
  authenticate,
  asyncHandler(bookmarksController.deleteBookmark)
)

export default router
