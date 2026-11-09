import { Schema, model } from 'mongoose'
const schema = new Schema({
  _id: { type: String }, siteName: { type: String, required: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  announcement: { type: String, default: '', maxlength: 1000 },
  version: { type: Number, default: 0 },
}, { versionKey: false, timestamps: true })
export const SiteConfig = model('SiteConfig', schema)
