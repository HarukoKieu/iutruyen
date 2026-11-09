import { Schema, model, type Types } from 'mongoose'

export interface CrawlerStorySourceRecord {
  _id: Types.ObjectId
  sourceHash: string
  sourceUrl: string
  storyId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const schema = new Schema<CrawlerStorySourceRecord>({
  sourceHash: { type: String, required: true, match: /^[a-f\d]{64}$/ },
  sourceUrl: { type: String, required: true, maxlength: 2048 },
  storyId: { type: Schema.Types.ObjectId, required: true, ref: 'Story' },
}, { timestamps: true, versionKey: false, strict: 'throw' })

schema.index({ sourceHash: 1 }, { unique: true, name: 'crawler_story_source_identity' })
schema.index({ storyId: 1 }, { name: 'crawler_story_source_story' })

export const CrawlerStorySource = model<CrawlerStorySourceRecord>('CrawlerStorySource', schema)
