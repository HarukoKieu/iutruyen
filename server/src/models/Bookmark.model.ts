import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IBookmark extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  chapterId: Types.ObjectId
  note?: string
  createdAt: Date
  updatedAt: Date
}

const bookmarkSchema = new Schema<IBookmark>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    chapterId: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
)

// Unique compound index: 1 bookmark per user per chapter
bookmarkSchema.index({ userId: 1, chapterId: 1 }, { unique: true })
bookmarkSchema.index({ userId: 1, createdAt: -1, _id: -1 })

export const Bookmark = mongoose.model<IBookmark>('Bookmark', bookmarkSchema)
