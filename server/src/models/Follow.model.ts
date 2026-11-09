import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IFollow extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  storyId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const followSchema = new Schema<IFollow>(
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
  },
  {
    timestamps: true,
  }
)

// Unique compound index: 1 follow per user per story
followSchema.index({ userId: 1, storyId: 1 }, { unique: true })
followSchema.index({ userId: 1, createdAt: -1, _id: -1 })

export const Follow = mongoose.model<IFollow>('Follow', followSchema)
