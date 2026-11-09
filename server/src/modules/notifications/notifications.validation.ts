import { z } from 'zod'
import { NOTIFICATION_TYPES } from '../../models/Notification.model.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const notificationIdParamSchema = z.object({
  id: z
    .string()
    .regex(objectIdRegex, 'Notification ID không đúng định dạng ObjectId'),
})

export const queryNotificationsSchema = z.object({
  isRead: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true
      if (val === 'false') return false
      return undefined
    }),
  type: z
    .enum(NOTIFICATION_TYPES)
    .optional(),
  cursor: z
    .string()
    .regex(objectIdRegex, 'Cursor phải là ObjectId hợp lệ')
    .optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(50)),
})

export type QueryNotificationsDto = z.infer<typeof queryNotificationsSchema>
export type NotificationIdParamDto = z.infer<typeof notificationIdParamSchema>
