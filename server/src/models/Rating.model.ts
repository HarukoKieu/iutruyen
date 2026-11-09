import mongoose, { Schema, Document, Types } from 'mongoose'

export interface RatingDocument extends Document {
  _id: Types.ObjectId
  storyId: Types.ObjectId
  userId: Types.ObjectId
  score: 1 | 2 | 3 | 4 | 5
  createdAt: Date
  updatedAt: Date
}

export type IRating = RatingDocument

const ratingSchema = new Schema<RatingDocument>(
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
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: (v: number) => [1, 2, 3, 4, 5].includes(v),
        message: 'Score must be an integer between 1 and 5',
      },
    },
  },
  {
    timestamps: true,
  }
)

// Unique compound index: 1 rating per user per story (allows upsert)
ratingSchema.index({ storyId: 1, userId: 1 }, { unique: true })

export const Rating = mongoose.model<RatingDocument>('Rating', ratingSchema)
