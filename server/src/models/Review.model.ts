import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ReviewDocument extends Document {
  _id: Types.ObjectId
  storyId: Types.ObjectId
  userId: Types.ObjectId
  content: string
  likeCount: number
  likedUserIds: Types.ObjectId[]
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

export type IReview = ReviewDocument

export interface PopulatedReview {
  _id: Types.ObjectId
  storyId: Types.ObjectId
  userId: {
    _id: Types.ObjectId
    displayName: string
    username: string
    avatarUrl?: string
    role: string
    authorStatus?: string
  }
  content: string
  likeCount: number
  likedUserIds?: Types.ObjectId[]
  likedByMe?: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

const reviewSchema = new Schema<ReviewDocument>(
  {
    storyId: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      minlength: 50,
      maxlength: 3000,
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
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

// Unique compound index: 1 review per user per story
reviewSchema.index({ storyId: 1, userId: 1 }, { unique: true })
// Sort by most liked / newest
reviewSchema.index({ storyId: 1, likeCount: -1, createdAt: -1 })

export const Review = mongoose.model<ReviewDocument>('Review', reviewSchema)
