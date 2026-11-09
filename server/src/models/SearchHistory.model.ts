import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ISearchHistory extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  query: string
  createdAt: Date
  updatedAt: Date
}

const searchHistorySchema = new Schema<ISearchHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
  }
)

// Compound index to quickly find or upsert per user and query
searchHistorySchema.index({ userId: 1, query: 1 }, { unique: true })
// Index to query recent searches sorted by latest time
searchHistorySchema.index({ userId: 1, updatedAt: -1 })

export const SearchHistory = mongoose.model<ISearchHistory>(
  'SearchHistory',
  searchHistorySchema
)
