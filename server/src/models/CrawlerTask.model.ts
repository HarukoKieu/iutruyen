import { Schema, model, type Types } from 'mongoose'

export type CrawlerTaskStatus = 'pending' | 'succeeded' | 'skipped' | 'failed'
export interface CrawlerTaskRecord {
  _id: Types.ObjectId
  jobId: Types.ObjectId
  sourceIndex: number
  sourceHash: string
  url: string
  title: string
  order: number
  position: number
  status: CrawlerTaskStatus
  attempts: number
  nextRunAt: Date
  errorCode?: string
  chapterId?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
const schema = new Schema<CrawlerTaskRecord>({
  jobId: { type: Schema.Types.ObjectId, required: true, ref: 'CrawlerJob' },
  sourceIndex: { type: Number, required: true, min: 0, max: 19, validate: Number.isSafeInteger },
  sourceHash: { type: String, required: true, match: /^[a-f\d]{64}$/ },
  url: { type: String, required: true, maxlength: 2048 },
  title: { type: String, required: true, maxlength: 200 },
  order: { type: Number, required: true, min: 1, max: 1000000, validate: Number.isSafeInteger },
  position: { type: Number, required: true, min: 1, max: 2000, validate: Number.isSafeInteger },
  status: { type: String, required: true, enum: ['pending', 'succeeded', 'skipped', 'failed'], default: 'pending' },
  attempts: { type: Number, required: true, default: 0, min: 0, max: 3, validate: Number.isSafeInteger },
  nextRunAt: { type: Date, required: true, default: Date.now },
  errorCode: { type: String, maxlength: 100 },
  chapterId: { type: Schema.Types.ObjectId, ref: 'Chapter' },
}, { timestamps: true, versionKey: false, strict: 'throw' })
schema.index({ jobId: 1, sourceIndex: 1, sourceHash: 1 }, { unique: true, name: 'crawler_task_url' })
schema.index({ jobId: 1, sourceIndex: 1, position: 1 }, { unique: true, name: 'crawler_task_position' })
schema.index({ jobId: 1, status: 1, nextRunAt: 1, sourceIndex: 1, position: 1 }, { name: 'crawler_task_queue' })
schema.index({ jobId: 1, _id: 1 }, { name: 'crawler_task_cursor' })
schema.index({ jobId: 1, status: 1, _id: 1 }, { name: 'crawler_task_status_cursor' })
export const CrawlerTask = model<CrawlerTaskRecord>('CrawlerTask', schema)
