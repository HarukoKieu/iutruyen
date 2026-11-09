import { Router } from 'express'
import { searchController } from './search.controller.js'
import {
  searchStoriesQuerySchema,
  searchSuggestionsQuerySchema,
  deleteSearchHistoryQuerySchema,
} from './search.validation.js'
import { validate } from '../../middlewares/validate.js'
import { authenticate, optionalAuthenticate } from '../../middlewares/authenticate.js'
import { rateLimit } from '../../middlewares/rateLimit.js'
import { asyncHandler } from '../../common/asyncHandler.js'

const searchRouter = Router()

// Rate limit: 60 requests / minute for public search
const searchRateLimiter = rateLimit({
  windowSeconds: 60,
  maxRequests: 60,
  prefix: 'search',
  message: 'Bạn đang tìm kiếm quá nhanh, vui lòng thử lại sau',
})

// Public search endpoints
searchRouter.get(
  '/stories',
  searchRateLimiter,
  optionalAuthenticate,
  validate({ query: searchStoriesQuerySchema }),
  asyncHandler(searchController.searchStories)
)

searchRouter.get(
  '/suggestions',
  searchRateLimiter,
  optionalAuthenticate,
  validate({ query: searchSuggestionsQuerySchema }),
  asyncHandler(searchController.getSuggestions)
)

// User search history router mounted at /api/v1/users/me/search-history
export const userSearchHistoryRouter = Router()

userSearchHistoryRouter.get(
  '/',
  authenticate,
  asyncHandler(searchController.getSearchHistory)
)

userSearchHistoryRouter.delete(
  '/',
  authenticate,
  validate({ query: deleteSearchHistoryQuerySchema }),
  asyncHandler(searchController.deleteSearchHistory)
)

export default searchRouter
