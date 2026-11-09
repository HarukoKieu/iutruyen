import mongoose, { Document, Schema, Types } from 'mongoose'

export type ModerationAction =
  | 'approve_story'
  | 'request_revision_story'
  | 'hide_story'
  | 'remove_story'
  | 'approve_chapter'
  | 'request_revision_chapter'
  | 'hide_chapter'
  | 'remove_chapter'
  | 'approve_comment'
  | 'hide_comment'
  | 'delete_comment'
  | 'resolve_report'
  | 'dismiss_report'
  | 'assign_report'
  | 'add_report_note'
  | 'warn_user'
  | 'suspend_user'

export type ModerationTargetType = 'story' | 'chapter' | 'comment' | 'user' | 'report'

export interface IModerationLog extends Document {
  _id: Types.ObjectId
  moderatorId: Types.ObjectId
  action: ModerationAction | string
  targetType: ModerationTargetType
  targetId: Types.ObjectId
  targetTitle?: string
  reason?: string
  note?: string
  metadata?: Record<string, any>
  createdAt: Date
}

const moderationLogSchema = new Schema<IModerationLog>(
  {
    moderatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['story', 'chapter', 'comment', 'user', 'report'],
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    targetTitle: {
      type: String,
      default: '',
    },
    reason: {
      type: String,
      default: '',
    },
    note: {
      type: String,
      default: '',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
)

moderationLogSchema.index({ createdAt: -1 })
moderationLogSchema.index({ targetType: 1, targetId: 1 })
moderationLogSchema.index({ moderatorId: 1, createdAt: -1 })

export const ModerationLog = mongoose.model<IModerationLog>('ModerationLog', moderationLogSchema)
