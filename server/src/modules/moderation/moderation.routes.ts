import { Router } from 'express'
import { moderationController } from './moderation.controller.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireRole } from '../../middlewares/requireRole.js'
import { validate } from '../../middlewares/validate.js'
import { rateLimit } from '../../middlewares/rateLimit.js'
import {
  queueQuerySchema,
  moderationActionSchema,
  createReportSchema,
  reportActionSchema,
  addReportNoteSchema,
  reportsQuerySchema,
  historyQuerySchema,
  targetIdParamSchema,
  storyActionParamSchema,
  chapterActionParamSchema,
  commentActionParamSchema,
} from './moderation.validation.js'

const router = Router()

// ─── Public / Authenticated User Report Endpoint ─────────────────────────────
// POST /api/v1/reports
export const reportsPublicRouter = Router()
reportsPublicRouter.post(
  '/',
  authenticate,
  rateLimit({ windowSeconds: 60, maxRequests: 5, prefix: 'report-create' }),
  validate({ body: createReportSchema }),
  moderationController.createReport
)

// ─── Moderator / Admin Routes ────────────────────────────────────────────────
// All routes below require authenticate + role 'moderator' or 'admin'
const requireMod = requireRole(['moderator', 'admin'])

// Summary
router.get('/queue/summary', authenticate, requireMod, moderationController.getSummary)

// Story Queue & Actions
router.get(
  '/queue/stories',
  authenticate,
  requireMod,
  validate({ query: queueQuerySchema }),
  moderationController.getStoryQueue
)
router.patch(
  '/stories/:id/:action(approve|hide|remove|request_revision)',
  authenticate,
  requireMod,
  validate({ params: storyActionParamSchema, body: moderationActionSchema }),
  moderationController.moderateStory
)

// Chapter Queue & Actions
router.get(
  '/queue/chapters',
  authenticate,
  requireMod,
  validate({ query: queueQuerySchema }),
  moderationController.getChapterQueue
)
router.patch(
  '/chapters/:id/:action(approve|hide|remove)',
  authenticate,
  requireMod,
  validate({ params: chapterActionParamSchema, body: moderationActionSchema }),
  moderationController.moderateChapter
)

// Comment Queue & Actions
router.get(
  '/queue/comments',
  authenticate,
  requireMod,
  validate({ query: queueQuerySchema }),
  moderationController.getCommentQueue
)
router.patch(
  '/comments/:id/:action(approve|hide|delete)',
  authenticate,
  requireMod,
  validate({ params: commentActionParamSchema, body: moderationActionSchema }),
  moderationController.moderateComment
)

// Reports Queue & Details
router.get(
  '/reports',
  authenticate,
  requireMod,
  validate({ query: reportsQuerySchema }),
  moderationController.getReports
)
router.get(
  '/reports/:id',
  authenticate,
  requireMod,
  validate({ params: targetIdParamSchema }),
  moderationController.getReportDetail
)
router.patch(
  '/reports/:id/action',
  authenticate,
  requireMod,
  validate({ params: targetIdParamSchema, body: reportActionSchema }),
  moderationController.actionReport
)
router.post(
  '/reports/:id/notes',
  authenticate,
  requireMod,
  validate({ params: targetIdParamSchema, body: addReportNoteSchema }),
  moderationController.addReportNote
)
router.patch(
  '/reports/:id/assign',
  authenticate,
  requireMod,
  validate({ params: targetIdParamSchema }),
  moderationController.assignReport
)

// Moderation History (Audit Log)
router.get(
  '/history',
  authenticate,
  requireMod,
  validate({ query: historyQuerySchema }),
  moderationController.getModerationHistory
)

export default router
