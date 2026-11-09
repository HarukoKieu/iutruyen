import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IGenre extends Document {
  _id: Types.ObjectId
  name: string
  slug: string
  description?: string
  iconName?: string
  createdAt: Date
  updatedAt: Date
}

const genreSchema = new Schema<IGenre>(
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
    description: {
      type: String,
      trim: true,
    },
    iconName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

export const Genre = mongoose.model<IGenre>('Genre', genreSchema)
