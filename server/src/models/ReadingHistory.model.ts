import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IReadingHistory extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  storyId: Types.ObjectId
  lastChapterId: Types.ObjectId
  scrollPositionPercent: number
  lastReadAt: Date
  createdAt: Date
  updatedAt: Date
}

const readingHistorySchema = new Schema<IReadingHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    storyId: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
      index: true,
    },
    lastChapterId: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true,
    },
    scrollPositionPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

// Unique compound index: 1 record per user per story
readingHistorySchema.index({ userId: 1, storyId: 1 }, { unique: true })
readingHistorySchema.index({ userId: 1, lastReadAt: -1 })
readingHistorySchema.index({ userId: 1, lastReadAt: -1, _id: -1 })

export const ReadingHistory = mongoose.model<IReadingHistory>('ReadingHistory', readingHistorySchema)
