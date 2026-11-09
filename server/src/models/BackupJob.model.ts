import { Schema, model } from 'mongoose'

const schema = new Schema({
  actorId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  reason: { type: String, required: true, maxlength: 500 },
  requestId: { type: String, required: true, maxlength: 200 },
  status: { type: String, required: true, enum: ['queued', 'running', 'succeeded', 'failed'], default: 'queued' },
  active: { type: Boolean, required: true, default: true },
  consistency: { type: String, default: 'logical_non_snapshot', enum: ['logical_non_snapshot'] },
  leaseOwner: String, leaseUntil: Date, startedAt: Date, finishedAt: Date,
  artifactKey: String, sizeBytes: Number, sha256: String, errorCode: String,
}, { timestamps: true, versionKey: false })
schema.index({ active: 1 }, { unique: true, partialFilterExpression: { active: true } })
schema.index({ createdAt: -1, _id: -1 })
schema.index({ status: 1, leaseUntil: 1 })
export const BackupJob = model('BackupJob', schema)
