import type { Story } from './story'
import type { Chapter } from './chapter'
import type { Comment } from './comment'
import type { PublicUserProfile } from './user'

export type ModerationTargetType = 'story' | 'chapter' | 'comment' | 'user' | 'report'

export type ReportStatus = 'pending' | 'in_progress' | 'resolved' | 'dismissed'

export interface ModerationSummary {
  pendingStories: number
  pendingChapters: number
  spamComments: number
  pendingReports: number
  totalPending: number
}

export interface ReportItem {
  _id: string
  reportNumber?: string
  reporterId: PublicUserProfile
  targetType: 'story' | 'chapter' | 'comment' | 'user'
  targetId: string
  reason: string
  description?: string
  evidenceUrls?: string[]
  status: ReportStatus
  assignedTo?: PublicUserProfile | null
  resolvedBy?: PublicUserProfile | string | null
  resolvedNote?: string | null
  resolution?: {
    action: string
    moderatorId: PublicUserProfile
    note?: string
    resolvedAt: string
  }
  notes?: Array<{
    moderatorId: PublicUserProfile
    note: string
    createdAt: string
  }>
  createdAt: string
  updatedAt: string
}

// Moderation endpoints return a safe projection, not a complete public entity.
export interface ReportTargetSnapshot {
  _id: string
  title?: string
  slug?: string
  description?: string
  coverUrl?: string
  moderationStatus?: string
  order?: number
  content?: string
  storyId?: string | { title?: string; slug?: string }
  authorId?: PublicUserProfile
  userId?: PublicUserProfile
  displayName?: string
  username?: string
  email?: string
  role?: string
  isLocked?: boolean
}
export type ReportTargetData = ReportTargetSnapshot | null

export interface ReportDetailResponse {
  report: ReportItem
  targetData: ReportTargetData
  stats: {
    targetOtherReportsCount: number
    reporterTotalReportsCount: number
  }
  targetAuditLogs: ModerationLogItem[]
}

export interface ModerationLogItem {
  _id: string
  moderatorId: PublicUserProfile
  action: string
  targetType: ModerationTargetType
  targetId: string
  targetTitle?: string
  reason?: string
  note?: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface QueuePaginationMeta {
  limit: number
  nextCursor: string | null
  hasMore: boolean
}

export interface QueueStoriesResponse {
  stories: Story[]
  meta: QueuePaginationMeta
}

export interface QueueChaptersResponse {
  chapters: Chapter[]
  meta: QueuePaginationMeta
}

export interface QueueCommentsResponse {
  comments: Comment[]
  meta: QueuePaginationMeta
}

export interface ReportsResponse {
  reports: ReportItem[]
  meta: QueuePaginationMeta
}

export interface ModerationHistoryResponse {
  logs: ModerationLogItem[]
  meta: QueuePaginationMeta
}

export interface ModerationActionInput {
  reason?: string
  note?: string
  notifyUser?: boolean
}

export interface ReportActionInput {
  action: 'dismiss' | 'request_revision' | 'hide' | 'remove' | 'warn_user'
  note?: string
  notifyUser?: boolean
}

export interface CreateReportInput {
  targetType: 'story' | 'chapter' | 'comment' | 'user'
  targetId: string
  reason: string
  description?: string
  evidenceUrls?: string[]
}

