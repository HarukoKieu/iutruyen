import mongoose, { Schema, Document, Types } from 'mongoose'
import { removeRetiredAccessFields } from '../common/freeContent.js'

export interface IChapter extends Document {
  _id: Types.ObjectId
  storyId: Types.ObjectId
  title: string
  slug: string
  order: number
  contentHtml: string
  status: 'draft' | 'scheduled' | 'published'
  moderationStatus: 'pending' | 'approved' | 'hidden'
  wordCount: number
  publishAt?: Date
  viewCount: number
  createdAt: Date
  updatedAt: Date
}

const chapterSchema = new Schema<IChapter>(
  {
    storyId: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
    },
    contentHtml: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published'],
      default: 'draft',
      index: true,
    },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'hidden'],
      default: 'pending',
      index: true,
    },
    wordCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    publishAt: {
      type: Date,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { removeRetiredAccessFields(ret); return ret } },
    toObject: { transform: (_doc, ret) => { removeRetiredAccessFields(ret); return ret } },
  }
)

// Unique compound indexes according to docs/03-DATABASE-SCHEMA.md
chapterSchema.index({ storyId: 1, order: 1 }, { unique: true })
chapterSchema.index({ storyId: 1, slug: 1 }, { unique: true })
chapterSchema.index({ status: 1, publishAt: 1 })
chapterSchema.index({ storyId: 1, status: 1, moderationStatus: 1 })

export const Chapter = mongoose.model<IChapter>('Chapter', chapterSchema)
