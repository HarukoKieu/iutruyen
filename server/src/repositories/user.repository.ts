import { User, IUser } from '../models/User.model.js'

export const findById = async (id: string): Promise<IUser | null> => {
  return User.findById(id)
}

export const findByEmail = async (email: string): Promise<IUser | null> => {
  return User.findOne({ email: email.toLowerCase().trim() })
}

export const findByUsername = async (username: string): Promise<IUser | null> => {
  return User.findOne({ username: username.toLowerCase().trim() })
}

export const findByProvider = async (provider: string, providerId: string): Promise<IUser | null> => {
  return User.findOne({ provider, providerId })
}

export const create = async (data: Partial<IUser>): Promise<IUser> => {
  return User.create(data)
}

export const updateById = async (id: string, updateData: Partial<IUser>): Promise<IUser | null> => {
  return User.findByIdAndUpdate(id, { $set: updateData }, { new: true })
}

export interface CredentialState { email: string; authVersion: number }

// Missing epochs on legacy accounts mean zero, but all writes advance the epoch.
const credentialFilter = (id: string, state: CredentialState) => ({
  _id: id, email: state.email,
  ...(state.authVersion === 0
    ? { $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] }
    : { authVersion: state.authVersion }),
})

/** Compare-and-swap makes credential recovery single-use and revokes old sessions. */
export const updatePassword = async (id: string, hashedPassword: string, expected: CredentialState): Promise<IUser | null> => {
  return User.findOneAndUpdate(credentialFilter(id, expected), {
    $set: { password: hashedPassword }, $inc: { authVersion: 1 },
  }, { new: true, runValidators: true })
}

/** Only a confirmed pending mailbox may replace the current login/recovery address. */
export const confirmEmailChange = async (id: string, email: string, expected: CredentialState): Promise<IUser | null> => {
  return User.findOneAndUpdate(credentialFilter(id, expected), {
    $set: { email, isEmailVerified: true }, $inc: { authVersion: 1 },
  }, { new: true, runValidators: true })
}

export const updateAvatar = async (id: string, avatarUrl: string): Promise<IUser | null> => {
  return User.findByIdAndUpdate(id, { $set: { avatarUrl } }, { new: true })
}

export const updateLastLogin = async (id: string): Promise<IUser | null> => {
  return User.findByIdAndUpdate(id, { $set: { lastLoginAt: new Date() } }, { new: true })
}

export const verifyEmail = async (id: string, expected: CredentialState): Promise<IUser | null> => {
  return User.findOneAndUpdate(credentialFilter(id, expected), { $set: { isEmailVerified: true } }, { new: true })
}

export const findPublicProfile = async (id: string) => {
  return User.findById(id).select('username displayName avatarUrl role authorStatus bio createdAt')
}

export const findByIdSafe = async (id: string): Promise<IUser | null> => {
  return User.findById(id).select('-password')
}

export const userRepository = {
  findById,
  findByEmail,
  findByUsername,
  findByProvider,
  create,
  updateById,
  updatePassword,
  confirmEmailChange,
  updateAvatar,
  updateLastLogin,
  verifyEmail,
  findPublicProfile,
  findByIdSafe,
}
