import { Schema, model } from 'mongoose'
const schema = new Schema({ _id: { type: String }, revision: { type: Number, default: 0 } }, { versionKey: false })
export const AdminControl = model('AdminControl', schema)
