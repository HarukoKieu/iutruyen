import { Router, type ErrorRequestHandler } from 'express'
import { AppError } from '../../common/AppError.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { requireRole } from '../../middlewares/requireRole.js'
import { rateLimit } from '../../middlewares/rateLimit.js'
import { validate } from '../../middlewares/validate.js'
import { adminController as controller } from './admin.controller.js'
import { actions, mutationSchema, confirmationSchema, usersQuery, storiesQuery, auditQuery, chartsQuery, configSchema, idParams, backupsQuery, backupSchema } from './admin.validation.js'

const router = Router()
const quota = (prefix: string, maxRequests: number) => rateLimit({ prefix, windowSeconds: 60, maxRequests, keyGenerator: req => req.user!.id })
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow'); next() })
router.use(authenticate, requireRole(['admin']))
router.use(quota('admin-read', 120))
router.get('/dashboard/overview', controller.overview)
router.get('/dashboard/charts', validate({ query: chartsQuery }), controller.charts)
router.get('/users', validate({ query: usersQuery }), controller.users)
router.get('/users/:id', validate({ params: idParams }), controller.user)
router.get('/stories', validate({ query: storiesQuery }), controller.stories)
router.get('/audit-logs', validate({ query: auditQuery }), controller.audit)
router.get('/config', controller.config)
router.put('/config', quota('admin-write', 20), validate({ body: configSchema }), controller.updateConfig)
router.post('/action-confirmations', quota('admin-step-up', 5), validate({ body: confirmationSchema }), controller.confirm)
for (const action of actions.options) router.patch(`/users/:id/${action}`, quota('admin-write', 20), validate({ params: idParams, body: mutationSchema(action) }), controller.mutate(action))
router.get('/backups', validate({ query: backupsQuery }), controller.backups)
router.post('/backups', quota('admin-backup', 2), validate({ body: backupSchema }), controller.enqueueBackup)
const queryError: ErrorRequestHandler = (error, _req, _res, next) => {
  next(error?.code === 50 ? new AppError(503, 'Truy vấn quản trị vượt thời gian; vui lòng thử lại', 'ADMIN_QUERY_TIMEOUT') : error)
}
router.use(queryError)
export default router
