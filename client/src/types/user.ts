export type UserRole = 'user' | 'author' | 'moderator' | 'admin'
export type AuthorStatus = 'pending' | 'approved' | 'revoked'
export type AuthProvider = 'local' | 'google' | 'facebook'

export interface User {
  id: string
  email: string
  username: string
  displayName: string
  role: UserRole
  authorStatus?: AuthorStatus
  avatarUrl?: string
  bio?: string
  isEmailVerified: boolean
  provider?: AuthProvider
  isLocked?: boolean
  lockedReason?: string
  lastLoginAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface PublicUserProfile {
  _id?: string
  id?: string
  username: string
  displayName: string
  avatarUrl?: string
  role: UserRole
  authorStatus?: AuthorStatus
  bio?: string
  createdAt?: string
}
