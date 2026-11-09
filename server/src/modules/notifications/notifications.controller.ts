import { Request, Response } from 'express'
import { asyncHandler } from '../../common/asyncHandler.js'
import { ApiResponse } from '../../common/ApiResponse.js'
import { notificationsService } from './notifications.service.js'
import type { QueryNotificationsDto, NotificationIdParamDto } from './notifications.validation.js'

export const notificationsController = {
  getMyNotifications: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id
    const query = req.query as unknown as QueryNotificationsDto

    const { notifications, nextCursor, unreadCount } =
      await notificationsService.getUserNotifications(userId, query)

    return ApiResponse.success(res, notifications, {
      message: 'Lấy danh sách thông báo thành công',
      meta: { nextCursor, unreadCount },
    })
  }),

  getUnreadCount: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id
    const unreadCount = await notificationsService.getUnreadCount(userId)

    return ApiResponse.success(res, { unreadCount }, {
      message: 'Lấy số lượng thông báo chưa đọc thành công',
    })
  }),

  markAsRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id
    const { id } = req.params as unknown as NotificationIdParamDto

    const updated = await notificationsService.markAsRead(userId, id)

    return ApiResponse.success(res, updated, {
      message: 'Đã đánh dấu thông báo là đã đọc',
    })
  }),

  markAllAsRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id
    const modifiedCount = await notificationsService.markAllAsRead(userId)

    return ApiResponse.success(res, { modifiedCount }, {
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
    })
  }),

  deleteNotification: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id
    const { id } = req.params as unknown as NotificationIdParamDto

    await notificationsService.deleteNotification(userId, id)

    return ApiResponse.success(res, { id }, {
      message: 'Đã xóa thông báo thành công',
    })
  }),
}
