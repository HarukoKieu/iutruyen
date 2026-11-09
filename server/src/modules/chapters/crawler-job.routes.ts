import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireRole } from '../../middlewares/requireRole.js'
import { requireAuthorApproved } from '../../middlewares/requireAuthorApproved.js'
import { rateLimit } from '../../middlewares/rateLimit.js'
import { validate } from '../../middlewares/validate.js'
import { asyncHandler } from '../../common/asyncHandler.js'
import { crawlerJobController as controller } from './crawler-job.controller.js'
import { crawlerJobCreateSchema, crawlerJobControlSchema, crawlerJobParamsSchema, crawlerJobsQuerySchema, crawlerTasksQuerySchema, crawlerTargetsQuerySchema } from './crawler-job.validation.js'

const router = Router()
const base = '/stories/crawl/jobs'
const auth = [authenticate, requireRole(['author', 'admin']), requireAuthorApproved]
const write = rateLimit({ windowSeconds: 60, maxRequests: 20, prefix: 'crawler_job_write', keyGenerator: req => req.user!.id, message: 'Bạn đang thao tác quá nhanh. Vui lòng đợi.' })
const read = rateLimit({ windowSeconds: 60, maxRequests: 120, prefix: 'crawler_job_read', keyGenerator: req => req.user!.id, message: 'Bạn đang xem tiến độ quá nhanh. Vui lòng đợi.' })
router.get('/stories/crawl/targets', ...auth, read, validate({ query: crawlerTargetsQuerySchema }), asyncHandler(controller.targets))
router.post(base, ...auth, write, validate({ body: crawlerJobCreateSchema }), asyncHandler(controller.create))
router.get(base, ...auth, read, validate({ query: crawlerJobsQuerySchema }), asyncHandler(controller.list))
router.get(`${base}/:jobId`, ...auth, read, validate({ params: crawlerJobParamsSchema }), asyncHandler(controller.detail))
router.get(`${base}/:jobId/tasks`, ...auth, read, validate({ params: crawlerJobParamsSchema, query: crawlerTasksQuerySchema }), asyncHandler(controller.tasks))
router.post(`${base}/:jobId/control`, ...auth, write, validate({ params: crawlerJobParamsSchema, body: crawlerJobControlSchema }), asyncHandler(controller.control))
export default router
