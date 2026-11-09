import { Schema, model } from 'mongoose'

const schema = new Schema({
  actorId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  actorRole: { type: String, required: true, enum: ['admin'] },
  action: { type: String, required: true },
  targetType: { type: String, required: true, enum: ['user', 'config', 'backup'] },
  targetId: { type: String, required: true },
  before: { type: Schema.Types.Mixed, required: true },
  after: { type: Schema.Types.Mixed, required: true },
  reason: { type: String, required: true, maxlength: 500 },
  requestId: { type: String, required: true, maxlength: 200 },
  createdAt: { type: Date, required: true, default: Date.now },
}, { versionKey: false })
schema.index({ createdAt: -1, _id: -1 })
schema.index({ actorId: 1, createdAt: -1, _id: -1 })
export const AuditLog = model('AuditLog', schema)
