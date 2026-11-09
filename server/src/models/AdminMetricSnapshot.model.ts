import { Schema, model } from 'mongoose'
const schema = new Schema({
  _id: { type: String }, scopeVersion: { type: Number, required: true },
  sampledAt: { type: Date, required: true }, viewCount: { type: Number, required: true },
}, { versionKey: false })
schema.index({ scopeVersion: 1, sampledAt: 1 })
schema.index({ sampledAt: 1 }, { expireAfterSeconds: 180 * 86400 })
export const AdminMetricSnapshot = model('AdminMetricSnapshot', schema)
