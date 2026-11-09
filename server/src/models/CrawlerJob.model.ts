import { Schema, model, type Types } from 'mongoose'

export type CrawlerJobStatus = 'planning' | 'ready' | 'queued' | 'running' | 'paused' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled'
export type CrawlerControlAction = 'start' | 'pause' | 'resume' | 'cancel' | 'retry'
export interface CrawlerMetadata {
  title: string
  description: string
  originalAuthor?: string
  sourceName?: string
  genres?: string[]
  status?: 'ongoing' | 'completed' | 'hiatus'
  coverUrl?: string
}
export interface CrawlerDiscovery {
  nextUrl?: string
  visitedUrls: string[]
  seenHashes: string[]
  pageCount: number
  chapterCount: number
  complete: boolean
  attempts?: number
}
export interface CrawlerSource {
  url: string
  destination: 'new' | 'existing'
  storyId?: Types.ObjectId
  genreIds: Types.ObjectId[]
  from: number
  to: number
  startOrder: number
  metadata?: CrawlerMetadata
  reusedExisting?: boolean
  skipReason?: 'CRAWLER_STORY_EXISTS'
  counters?: CrawlerCounters
  discovery: CrawlerDiscovery
  warning?: string
  errorCode?: string
}
export interface CrawlerCounters {
  total: number
  pending: number
  succeeded: number
  skipped: number
  failed: number
}
export interface CrawlerJobRecord {
  _id: Types.ObjectId
  actorId: Types.ObjectId
  requestKey: string
  inputHash: string
  status: CrawlerJobStatus
  phase: 'planning' | 'importing'
  active: boolean
  revision: number
  sources: CrawlerSource[]
  rightsConfirmedAt?: Date
  leaseOwner?: string
  leaseUntil?: Date
  nextRunAt: Date
  counters: CrawlerCounters
  errorCode?: string
  createdAt: Date
  updatedAt: Date
  finishedAt?: Date
}

const integer = (min: number, max: number) => ({ type: Number, min, max, required: true, validate: Number.isSafeInteger })
const metadataSchema = new Schema<CrawlerMetadata>({
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 10000 },
  originalAuthor: { type: String, maxlength: 200 },
  sourceName: { type: String, maxlength: 2048 },
  genres: { type: [String], validate: (items: string[]) => items.length <= 20 && items.every(item => item.length <= 100) },
  status: { type: String, enum: ['ongoing', 'completed', 'hiatus'] },
  coverUrl: { type: String, maxlength: 2048 },
}, { _id: false, strict: 'throw' })
const discoverySchema = new Schema<CrawlerDiscovery>({
  nextUrl: { type: String, maxlength: 2048 },
  visitedUrls: { type: [String], default: [], validate: (items: string[]) => items.length <= 100 && items.every(item => item.length <= 2048) },
  seenHashes: { type: [String], default: [], validate: (items: string[]) => items.length <= 2000 && items.every(item => /^[a-f\d]{64}$/.test(item)) },
  pageCount: integer(0, 100),
  chapterCount: integer(0, 2000),
  complete: { type: Boolean, required: true },
  attempts: { ...integer(0, 3), required: false, default: 0 },
}, { _id: false, strict: 'throw' })
const countersSchema = new Schema<CrawlerCounters>({
  total: { ...integer(0, 10000), default: 0 },
  pending: { ...integer(0, 10000), default: 0 },
  succeeded: { ...integer(0, 10000), default: 0 },
  skipped: { ...integer(0, 10000), default: 0 },
  failed: { ...integer(0, 10000), default: 0 },
}, { _id: false, strict: 'throw' })
const sourceSchema = new Schema<CrawlerSource>({
  url: { type: String, required: true, maxlength: 2048 },
  destination: { type: String, required: true, enum: ['new', 'existing'] },
  storyId: { type: Schema.Types.ObjectId, ref: 'Story' },
  genreIds: { type: [Schema.Types.ObjectId], ref: 'Genre', default: [], validate: (items: Types.ObjectId[]) => items.length <= 20 },
  from: integer(1, 2000),
  to: integer(1, 2000),
  startOrder: integer(1, 1000000),
  metadata: { type: metadataSchema },
  reusedExisting: Boolean,
  skipReason: { type: String, enum: ['CRAWLER_STORY_EXISTS'] },
  counters: { type: countersSchema, default: () => ({ total: 0, pending: 0, succeeded: 0, skipped: 0, failed: 0 }) },
  discovery: { type: discoverySchema, required: true },
  warning: { type: String, maxlength: 500 },
  errorCode: { type: String, maxlength: 100 },
}, { _id: false, strict: 'throw' })
const schema = new Schema<CrawlerJobRecord>({
  actorId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  requestKey: { type: String, required: true, maxlength: 36 },
  inputHash: { type: String, required: true, match: /^[a-f\d]{64}$/ },
  status: { type: String, required: true, enum: ['planning', 'ready', 'queued', 'running', 'paused', 'completed', 'completed_with_errors', 'failed', 'cancelled'], default: 'planning' },
  phase: { type: String, required: true, enum: ['planning', 'importing'], default: 'planning' },
  active: { type: Boolean, required: true, default: true },
  revision: { ...integer(0, Number.MAX_SAFE_INTEGER), default: 0 },
  sources: { type: [sourceSchema], required: true, validate: (items: CrawlerSource[]) => items.length >= 1 && items.length <= 20 },
  rightsConfirmedAt: Date,
  leaseOwner: { type: String, maxlength: 200 },
  leaseUntil: Date,
  nextRunAt: { type: Date, required: true, default: Date.now },
  counters: { type: countersSchema, required: true, default: () => ({ total: 0, pending: 0, succeeded: 0, skipped: 0, failed: 0 }) },
  errorCode: { type: String, maxlength: 100 },
  finishedAt: Date,
}, { timestamps: true, versionKey: false, strict: 'throw' })
schema.index({ actorId: 1, requestKey: 1 }, { unique: true, name: 'crawler_request_key' })
schema.index({ actorId: 1, active: 1 }, { unique: true, partialFilterExpression: { active: true }, name: 'crawler_active_actor' })
schema.index({ active: 1, status: 1, nextRunAt: 1, leaseUntil: 1, _id: 1 }, { name: 'crawler_queue' })
schema.index({ actorId: 1, createdAt: -1, _id: -1 }, { name: 'crawler_actor_cursor' })
export const CrawlerJob = model<CrawlerJobRecord>('CrawlerJob', schema)
