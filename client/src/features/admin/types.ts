import type { UserRole, AuthorStatus } from '@/types/user'
export interface AdminUser {
  id: string; email: string; username: string; displayName: string; provider: string
  role: UserRole; authorStatus?: AuthorStatus; isEmailVerified: boolean; isLocked: boolean
  lockedReason?: string; lockKind?: string; suspendedUntil?: string; adminVersion: number; createdAt: string
}
export interface Page<T> { data: T[]; meta: { hasMore: boolean; nextCursor: string | null; limit: number } }
export interface Overview {
  asOf: string; kpis: { users: number; authors: number; stories: number; publicChapters: number; pendingStories: number; pendingChapters: number; openReports: number }
  topStories: { id: string; title: string; slug: string; viewCount: number; contentWarning: string }[]
  health: { checkedAt: string; mongodb: string; redis: string }
}
export interface Chart { metric: string; timezone: string; semantics: string; points: { date: string; value: number | null }[] }
export interface SiteConfig { siteName: string; description: string; announcement: string; version: number }
export type AdminAction = 'ban' | 'unban' | 'suspend' | 'role' | 'author-status'
export interface ActionPayload { expectedVersion: number; reason: string; days?: number; role?: UserRole; status?: 'approved' | 'revoked' }
export interface AdminStory { id: string; title: string; slug: string; moderationStatus: string; contentWarning: string; chapterCount: number; viewCount: number }
export interface AuditItem { _id: string; actorId: string; action: string; targetId: string; targetType: string; reason: string; requestId: string; createdAt: string; before: Record<string, unknown>; after: Record<string, unknown> }
export interface BackupItem { id: string; actorId: string; status: 'queued' | 'running' | 'succeeded' | 'failed'; consistency: string; createdAt: string; startedAt?: string; finishedAt?: string; sizeBytes?: number; sha256?: string; errorCode?: string }
export interface Backups { status: string; reason: string; items: BackupItem[]; meta?: Page<BackupItem>['meta'] }
