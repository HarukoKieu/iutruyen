import mongoose, { Document, Schema, Types } from 'mongoose'
import { removeRetiredAccessFields } from '../common/freeContent.js'
import { isAccountLocked } from '../common/accountState.js'

export type UserRole = 'user' | 'author' | 'moderator' | 'admin'
export type AuthProvider = 'local' | 'google' | 'facebook'
export type AuthorStatus = 'pending' | 'approved' | 'revoked'

export interface IUser extends Document {
  _id: Types.ObjectId
  email: string
  password?: string
  provider: AuthProvider
  providerId?: string
  username: string
  displayName: string
  avatarUrl?: string
  bio?: string
  role: UserRole
  authorStatus?: AuthorStatus
  isEmailVerified: boolean
  isLocked: boolean
  lockedReason?: string
  lockKind?: 'ban' | 'suspend'
  suspendedUntil?: Date
  adminVersion: number
  authVersion: number
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: false,
    },
    provider: {
      type: String,
      enum: ['local', 'google', 'facebook'],
      default: 'local',
      required: true,
    },
    providerId: {
      type: String,
      required: false,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    avatarUrl: {
      type: String,
      required: false,
    },
    bio: {
      type: String,
      required: false,
      maxlength: 500,
    },
    role: {
      type: String,
      enum: ['user', 'author', 'moderator', 'admin'],
      default: 'user',
      required: true,
    },
    authorStatus: {
      type: String,
      enum: ['pending', 'approved', 'revoked'],
      required: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    lockedReason: {
      type: String,
      required: false,
    },
    lastLoginAt: {
      type: Date,
      required: false,
    },
    lockKind: { type: String, enum: ['ban', 'suspend'] },
    suspendedUntil: Date,
    adminVersion: { type: Number, default: 0, min: 0 },
    authVersion: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toObject: { transform: (_doc, ret) => { removeRetiredAccessFields(ret); return ret } },
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id
        const record = ret as any
        record.isLocked = isAccountLocked(record)
        delete record._id
        delete record.__v
        delete record.password
        removeRetiredAccessFields(record)
        return ret
      },
    },
  }
)

userSchema.index({ role: 1 })
userSchema.index({ createdAt: -1, _id: -1 })
userSchema.index({ role: 1, createdAt: -1, _id: -1 })

export const User = mongoose.model<IUser>('User', userSchema)
