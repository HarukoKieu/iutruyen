import mongoose, { Document, Schema, Types } from 'mongoose'

export const NOTIFICATION_TYPES = ['new_chapter', 'new_follow', 'comment_reply', 'comment_like', 'system'] as const
export type NotificationType = typeof NOTIFICATION_TYPES[number]

export interface INotification extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  type: NotificationType
  title: string
  message: string
  link?: string
  isRead: boolean
  meta?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    link: {
      type: String,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

// Compound Indexes for fast inbox filtering and unread count queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, _id: -1 })
notificationSchema.index({ userId: 1, isRead: 1, _id: -1 })

export const Notification = mongoose.model<INotification>('Notification', notificationSchema)
