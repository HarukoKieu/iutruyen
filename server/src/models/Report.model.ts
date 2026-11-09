import mongoose, { Document, Schema, Types } from 'mongoose'

export type ReportTargetType = 'story' | 'chapter' | 'comment' | 'user'

export type ReportStatus = 'pending' | 'in_progress' | 'resolved' | 'dismissed'

export type ReportReason =
  | 'inappropriate_content'
  | 'violence'
  | 'copyright'
  | 'spam'
  | 'hate_speech'
  | 'other'

export interface IReportResolution {
  action: string
  moderatorId: Types.ObjectId
  note?: string
  resolvedAt: Date
}

export interface IReportNote {
  moderatorId: Types.ObjectId
  note: string
  createdAt: Date
}

export interface IReport extends Document {
  _id: Types.ObjectId
  reportNumber: string
  reporterId: Types.ObjectId
  targetType: ReportTargetType
  targetId: Types.ObjectId
  reason: ReportReason | string
  description?: string
  evidenceUrls?: string[]
  status: ReportStatus
  assignedTo?: Types.ObjectId
  resolvedBy?: Types.ObjectId
  resolvedNote?: string
  resolution?: IReportResolution
  notes: IReportNote[]
  createdAt: Date
  updatedAt: Date
}

const reportSchema = new Schema<IReport>(
  {
    reportNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['story', 'chapter', 'comment', 'user'],
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    evidenceUrls: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'dismissed'],
      default: 'pending',
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedNote: {
      type: String,
      trim: true,
      default: null,
    },
    resolution: {
      action: { type: String },
      moderatorId: { type: Schema.Types.ObjectId, ref: 'User' },
      note: { type: String },
      resolvedAt: { type: Date },
    },
    notes: [
      {
        moderatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        note: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
)

// Auto-generate reportNumber (#1234...) if not present
reportSchema.pre('validate', function (next) {
  if (!this.reportNumber) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString()
    const timeSuffix = Date.now().toString().slice(-4)
    this.reportNumber = `#${timeSuffix}${randomSuffix}`
  }
  next()
})

// Compound indexes for performant querying in mod dashboard
reportSchema.index({ status: 1, createdAt: -1 })
reportSchema.index({ targetType: 1, targetId: 1 })
reportSchema.index({ reporterId: 1, createdAt: -1 })

export const Report = mongoose.model<IReport>('Report', reportSchema)

