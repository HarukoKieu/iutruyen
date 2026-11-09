import { Router, Request } from 'express'
import { chaptersController } from './chapters.controller.js'
import {
  createChapterSchema,
  updateChapterSchema,
  chapterListQuerySchema,
} from './chapters.validation.js'
import { validate } from '../../middlewares/validate.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireRole } from '../../middlewares/requireRole.js'
import { requireAuthorApproved } from '../../middlewares/requireAuthorApproved.js'
import { requireOwnership } from '../../middlewares/requireOwnership.js'
import { asyncHandler } from '../../common/asyncHandler.js'
import { storyRepository } from '../../repositories/story.repository.js'
import { chapterRepository } from '../../repositories/chapter.repository.js'
import { AppError } from '../../common/AppError.js'
import { Types } from 'mongoose'
import { rateLimit } from '../../middlewares/rateLimit.js'
import { crawlerController } from './crawler.controller.js'
import { crawlParamsSchema, crawlCatalogSchema, crawlPreviewSchema, crawlImportSchema } from './crawler.validation.js'

const writeRateLimit = rateLimit({
  windowSeconds: 60,
  maxRequests: 5,
  prefix: 'chapter_write',
  message: 'Bạn đang tạo/sửa chương quá nhanh, vui lòng thử lại sau',
})

const router = Router({ mergeParams: true })

const getStoryAuthorIdFromStoryParam = async (req: Request): Promise<string> => {
  const storyId = String(req.params.storyId)
  let story = null
  if (Types.ObjectId.isValid(storyId)) {
    story = await storyRepository.findById(storyId)
  }
  if (!story) {
    story = await storyRepository.findBySlug(storyId)
  }
  if (!story || story.moderationStatus === 'removed') {
    throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ', 'STORY_NOT_FOUND')
  }
  const rawAuthor: unknown = story.authorId
  if (rawAuthor instanceof Types.ObjectId) return rawAuthor.toString()
  if (typeof rawAuthor === 'object' && rawAuthor !== null && '_id' in rawAuthor) {
    return String((rawAuthor as { _id: unknown })._id)
  }
  return String(rawAuthor ?? '')
}

const getStoryAuthorIdFromChapterParam = async (req: Request): Promise<string> => {
  const chapterId = String(req.params.id)
  const chapter = await chapterRepository.findById(chapterId)
  if (!chapter) {
    throw AppError.notFound('Chương không tồn tại', 'CHAPTER_NOT_FOUND')
  }
  const storyDoc = chapter.storyId as { authorId?: { _id: Types.ObjectId } | Types.ObjectId }
  const authorId = storyDoc.authorId instanceof Types.ObjectId
    ? storyDoc.authorId.toString()
    : (storyDoc.authorId as { _id: Types.ObjectId } | undefined)?._id?.toString() ?? ''
  return authorId
}

// Optional Auth middleware helper so public routes can know user context (for reading history & preview permissions)
const optionalAuth = (req: Request, res: Parameters<typeof authenticate>[1], next: Parameters<typeof authenticate>[2]) => {
  authenticate(req, res, () => {
    next()
  })
}

// Public: Get chapters list by story
router.get(
  '/stories/:storyId/chapters',
  optionalAuth,
  validate({ query: chapterListQuerySchema }),
  asyncHandler(chaptersController.getChaptersByStory)
)

// Public: Get chapter by slug
router.get(
  '/stories/:storyId/chapters/:slug',
  optionalAuth,
  asyncHandler(chaptersController.getChapterBySlug)
)

// Author: Create chapter in story
router.post(
  '/stories/:storyId/chapters',
  authenticate,
  writeRateLimit,
  requireRole(['author', 'admin']),
  requireAuthorApproved,
  requireOwnership(getStoryAuthorIdFromStoryParam),
  validate({ body: createChapterSchema }),
  asyncHandler(chaptersController.createChapter)
)

// Author: Update chapter
router.patch(
  '/chapters/:id',
  authenticate,
  writeRateLimit,
  requireRole(['author', 'admin']),
  requireAuthorApproved,
  requireOwnership(getStoryAuthorIdFromChapterParam),
  validate({ body: updateChapterSchema }),
  asyncHandler(chaptersController.updateChapter)
)

// Author: Delete chapter
router.delete(
  '/chapters/:id',
  authenticate,
  requireRole(['author', 'admin']),
  requireAuthorApproved,
  requireOwnership(getStoryAuthorIdFromChapterParam),
  asyncHandler(chaptersController.deleteChapter)
)

// Author: Preview chapter
router.get(
  '/chapters/:id/preview',
  authenticate,
  requireRole(['author', 'admin']),
  requireAuthorApproved,
  requireOwnership(getStoryAuthorIdFromChapterParam),
  asyncHandler(chaptersController.getChapterPreview)
)

// Preview metadata before a story exists; no ownership lookup or database write.
router.post('/stories/crawl/metadata', authenticate, requireRole(['author', 'admin']),
  requireAuthorApproved, validate({ body: crawlPreviewSchema }), asyncHandler(crawlerController.metadata))

for (const [action, schema, handler] of [
  ['catalog', crawlCatalogSchema, crawlerController.catalog],
  ['preview', crawlPreviewSchema, crawlerController.preview],
  ['import', crawlImportSchema, crawlerController.importChapter],
] as const) {
  router.post(`/stories/:storyId/crawl/${action}`, authenticate, requireRole(['author', 'admin']),
    requireAuthorApproved, requireOwnership(getStoryAuthorIdFromStoryParam),
    validate({ params: crawlParamsSchema, body: schema }), asyncHandler(handler))
}

export default router
