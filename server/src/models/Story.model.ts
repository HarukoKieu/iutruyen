import mongoose, { Document, Schema, Types } from 'mongoose'
import { removeRetiredAccessFields } from '../common/freeContent.js'

export type StoryStatus = 'ongoing' | 'completed' | 'hiatus'
export type StoryModerationStatus = 'pending' | 'approved' | 'hidden' | 'removed'
export type StoryContentWarning = 'none' | 'mature18+'

export interface IStory extends Document {
  _id: Types.ObjectId
  title: string
  slug: string
  description: string
  originalAuthor?: string
  sourceName?: string
  coverUrl?: string
  authorId: Types.ObjectId
  genreIds: Types.ObjectId[]
  tagIds: Types.ObjectId[]
  status: StoryStatus
  moderationStatus: StoryModerationStatus
  contentWarning: StoryContentWarning
  isFeatured: boolean
  chapterCount: number
  viewCount: number
  followCount: number
  ratingAverage: number
  ratingCount: number
  createdAt: Date
  updatedAt: Date
}
export type StoryRecord = Omit<IStory, keyof Document> & { _id: Types.ObjectId }

const storySchema = new Schema<IStory>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    coverUrl: {
      type: String,
      trim: true,
    },
    originalAuthor: { type: String, trim: true, maxlength: 200 },
    sourceName: { type: String, trim: true, maxlength: 2048 },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    genreIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Genre',
      },
    ],
    tagIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
    status: {
      type: String,
      enum: ['ongoing', 'completed', 'hiatus'],
      default: 'ongoing',
    },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'hidden', 'removed'],
      default: 'pending',
    },
    contentWarning: {
      type: String,
      enum: ['none', 'mature18+'],
      default: 'none',
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    chapterCount: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    followCount: {
      type: Number,
      default: 0,
    },
    ratingAverage: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { removeRetiredAccessFields(ret); return ret } },
    toObject: { transform: (_doc, ret) => { removeRetiredAccessFields(ret); return ret } },
  }
)

// Indexes per docs/03-DATABASE-SCHEMA.md (Declared centrally to prevent duplicate index warnings)
storySchema.index({ slug: 1 }, { unique: true })
storySchema.index({ authorId: 1 })
storySchema.index({ moderationStatus: 1 })
storySchema.index({ isFeatured: 1 })
storySchema.index({ moderationStatus: 1, status: 1, genreIds: 1 })
storySchema.index({ title: 'text', description: 'text' })
storySchema.index({ viewCount: -1 })
storySchema.index({ followCount: -1 })
storySchema.index({ createdAt: -1 })
storySchema.index({ createdAt: -1, _id: -1 })
storySchema.index({ moderationStatus: 1, createdAt: -1, _id: -1 })
storySchema.index({ moderationStatus: 1, viewCount: -1, _id: -1 })
storySchema.index({ moderationStatus: 1, followCount: -1, _id: -1 })
storySchema.index({ moderationStatus: 1, ratingAverage: -1, _id: -1 })
storySchema.index({ moderationStatus: 1, chapterCount: -1, _id: -1 })

export const Story = mongoose.model<IStory>('Story', storySchema)
