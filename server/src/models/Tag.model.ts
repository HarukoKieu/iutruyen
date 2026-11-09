import mongoose, { Document, Schema, Types } from 'mongoose'

export interface ITag extends Document {
  _id: Types.ObjectId
  name: string
  slug: string
  createdAt: Date
  updatedAt: Date
}

const tagSchema = new Schema<ITag>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

export const Tag = mongoose.model<ITag>('Tag', tagSchema)
