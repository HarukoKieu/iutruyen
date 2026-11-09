import { Router } from 'express'
import { notificationsController } from './notifications.controller.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { validate } from '../../middlewares/validate.js'
import {
  queryNotificationsSchema,
  notificationIdParamSchema,
} from './notifications.validation.js'

const router = Router()

// All notification routes require authentication
router.use(authenticate)

// GET /notifications — Paginated list of notifications with filters
router.get(
  '/',
  validate({ query: queryNotificationsSchema }),
  notificationsController.getMyNotifications
)

// GET /notifications/unread-count — Quick unread count for badge
router.get('/unread-count', notificationsController.getUnreadCount)

// PATCH /notifications/read-all — Mark all notifications as read
router.patch('/read-all', notificationsController.markAllAsRead)

// PATCH /notifications/:id/read — Mark single notification as read
router.patch(
  '/:id/read',
  validate({ params: notificationIdParamSchema }),
  notificationsController.markAsRead
)

// DELETE /notifications/:id — Delete a notification
router.delete(
  '/:id',
  validate({ params: notificationIdParamSchema }),
  notificationsController.deleteNotification
)

export default router
