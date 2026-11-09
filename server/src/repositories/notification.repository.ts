import { Notification, INotification, NotificationType, NOTIFICATION_TYPES } from '../models/Notification.model.js'
import { Types } from 'mongoose'

const snippet = (value: string, max: number) => value.length <= max ? value : `${value.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, '')}…`
const normalizeNotification = (data: CreateNotificationInput) => ({
  ...data, title: snippet(data.title, 150), message: snippet(data.message, 500),
})

export interface CreateNotificationInput {
  userId: string | Types.ObjectId
  type: NotificationType
  title: string
  message: string
  link?: string
  meta?: Record<string, any>
}

export interface FindNotificationsOptions {
  isRead?: boolean
  type?: NotificationType
  cursor?: string
  limit?: number
}

export const notificationRepository = {
  async create(data: CreateNotificationInput): Promise<INotification> {
    return Notification.create({
      ...normalizeNotification(data),
      userId: typeof data.userId === 'string' ? new Types.ObjectId(data.userId) : data.userId,
    })
  },

  async createMany(dataArray: CreateNotificationInput[]): Promise<INotification[]> {
    if (dataArray.length === 0) return []
    const formatted = dataArray.map((item) => ({
      ...normalizeNotification(item),
      userId: typeof item.userId === 'string' ? new Types.ObjectId(item.userId) : item.userId,
    }))
    return Notification.insertMany(formatted) as unknown as Promise<INotification[]>
  },

  async findByUserId(
    userId: string | Types.ObjectId,
    options: FindNotificationsOptions = {}
  ): Promise<{ notifications: INotification[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(options.limit || 20, 1), 50)
    const query: any = {
      userId: typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
      type: { $in: NOTIFICATION_TYPES },
    }

    if (typeof options.isRead === 'boolean') {
      query.isRead = options.isRead
    }

    if (options.type) {
      query.type = options.type
    }

    if (options.cursor && Types.ObjectId.isValid(options.cursor)) {
      query._id = { $lt: new Types.ObjectId(options.cursor) }
    }

    const notifications = await Notification.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()

    let nextCursor: string | null = null
    if (notifications.length > limit) {
      notifications.pop()
      nextCursor = notifications[notifications.length - 1]?._id.toString() || null
    }

    return {
      notifications: notifications as unknown as INotification[],
      nextCursor,
    }
  },

  async countUnread(userId: string | Types.ObjectId): Promise<number> {
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId
    return Notification.countDocuments({
      userId: userObjectId,
      isRead: false,
      type: { $in: NOTIFICATION_TYPES },
    })
  },

  async markAsRead(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<INotification | null> {
    const notifObjectId = typeof id === 'string' ? new Types.ObjectId(id) : id
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId

    return Notification.findOneAndUpdate(
      { _id: notifObjectId, userId: userObjectId, type: { $in: NOTIFICATION_TYPES } },
      { $set: { isRead: true } },
      { new: true }
    )
  },

  async markAllAsRead(userId: string | Types.ObjectId): Promise<number> {
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId
    const result = await Notification.updateMany(
      { userId: userObjectId, isRead: false, type: { $in: NOTIFICATION_TYPES } },
      { $set: { isRead: true } }
    )
    return result.modifiedCount
  },

  async delete(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<boolean> {
    const notifObjectId = typeof id === 'string' ? new Types.ObjectId(id) : id
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId

    const result = await Notification.findOneAndDelete({
      _id: notifObjectId,
      userId: userObjectId,
    })
    return !!result
  },
}
