import mongoose, { Schema, Document, Types } from 'mongoose'

export interface CommentDocument extends Document {
  _id: Types.ObjectId
  storyId: Types.ObjectId
  chapterId?: Types.ObjectId
  userId: Types.ObjectId
  parentId?: Types.ObjectId | null
  replyToUserId?: Types.ObjectId | null
  content: string
  likeCount: number
  likedUserIds: Types.ObjectId[]
  replyCount: number
  spamScore: number
  isLocked: boolean
  isHidden?: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

export type IComment = CommentDocument

export interface PopulatedCommentUser {
  _id: Types.ObjectId
  displayName: string
  username: string
  avatarUrl?: string
  role: string
  authorStatus?: string
}

export interface PopulatedComment {
  _id: Types.ObjectId
  storyId: Types.ObjectId
  chapterId?: Types.ObjectId | null
  userId: PopulatedCommentUser
  parentId?: Types.ObjectId | null
  replyToUserId?: {
    _id: Types.ObjectId
    displayName: string
    username: string
  } | null
  content: string
  likeCount: number
  likedUserIds?: Types.ObjectId[]
  likedByMe?: boolean
  replyCount: number
  previewReplies?: PopulatedComment[]
  spamScore: number
  isLocked: boolean
  isHidden?: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

const commentSchema = new Schema<CommentDocument>(
  {
    storyId: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
      index: true,
    },
    chapterId: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      default: null,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    replyToUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    content: {
      type: String,
      required: true,
      maxlength: 1000,
      trim: true,
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    likedUserIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    spamScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isHidden: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
)

// Compound indices
commentSchema.index({ storyId: 1, chapterId: 1, parentId: 1, createdAt: -1 })
commentSchema.index({ parentId: 1, createdAt: 1 })

export const Comment = mongoose.model<CommentDocument>('Comment', commentSchema)
