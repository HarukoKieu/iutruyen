import { api } from '@/lib/axios'
import type { Story } from '@/types/story'
import type { Chapter } from '@/types/chapter'
import type { Comment } from '@/types/comment'
import type {
  ModerationSummary,
  QueueStoriesResponse,
  QueueChaptersResponse,
  QueueCommentsResponse,
  ReportsResponse,
  ReportDetailResponse,
  ModerationHistoryResponse,
  ModerationLogItem,
  ModerationActionInput,
  ReportActionInput,
  CreateReportInput,
  ReportItem,
  QueuePaginationMeta,
} from '@/types/moderation'

// ─── Queue ─────────────────────────────────────────────────────────────────

export interface QueueQueryParams {
  search?: string
  genre?: string
  sort?: 'oldest' | 'newest'
  cursor?: string
  limit?: number
}

export const fetchModerationSummary = async (): Promise<ModerationSummary> => {
  const { data } = await api.get<{ success: boolean; data: ModerationSummary }>(
    '/moderation/queue/summary'
  )
  return data.data
}

export const fetchStoryQueue = async (params: QueueQueryParams = {}): Promise<QueueStoriesResponse> => {
  const { data } = await api.get<{ success: boolean; data: Story[]; meta: QueuePaginationMeta }>(
    '/moderation/queue/stories',
    { params }
  )
  return { stories: data.data, meta: data.meta }
}

export const fetchChapterQueue = async (params: QueueQueryParams = {}): Promise<QueueChaptersResponse> => {
  const { data } = await api.get<{ success: boolean; data: Chapter[]; meta: QueuePaginationMeta }>(
    '/moderation/queue/chapters',
    { params }
  )
  return { chapters: data.data, meta: data.meta }
}

export const fetchCommentQueue = async (params: QueueQueryParams = {}): Promise<QueueCommentsResponse> => {
  const { data } = await api.get<{ success: boolean; data: Comment[]; meta: QueuePaginationMeta }>(
    '/moderation/queue/comments',
    { params }
  )
  return { comments: data.data, meta: data.meta }
}

// ─── Moderation Actions ────────────────────────────────────────────────────

export const moderateStory = async (
  id: string,
  action: 'approve' | 'hide' | 'remove' | 'request_revision',
  body: ModerationActionInput
): Promise<void> => {
  await api.patch(`/moderation/stories/${id}/${action}`, body)
}

export const moderateChapter = async (
  id: string,
  action: 'approve' | 'hide' | 'remove',
  body: ModerationActionInput
): Promise<void> => {
  await api.patch(`/moderation/chapters/${id}/${action}`, body)
}

export const moderateComment = async (
  id: string,
  action: 'approve' | 'hide' | 'delete',
  body: ModerationActionInput
): Promise<void> => {
  await api.patch(`/moderation/comments/${id}/${action}`, body)
}

// ─── Reports ───────────────────────────────────────────────────────────────

export interface ReportsQueryParams {
  status?: string
  targetType?: string
  cursor?: string
  limit?: number
}

export interface HistoryQueryParams {
  action?: string
  targetType?: string
  moderatorId?: string
  range?: 'all' | '24h' | '7d' | '30d'
  cursor?: string
  limit?: number
}

export const fetchReports = async (params: ReportsQueryParams = {}): Promise<ReportsResponse> => {
  const { data } = await api.get<{ success: boolean; data: ReportItem[]; meta: QueuePaginationMeta }>(
    '/moderation/reports',
    { params }
  )
  return { reports: data.data, meta: data.meta }
}

export const fetchReportDetail = async (id: string): Promise<ReportDetailResponse> => {
  const { data } = await api.get<{ success: boolean; data: ReportDetailResponse }>(
    `/moderation/reports/${id}`
  )
  return data.data
}

export const submitReportAction = async (id: string, body: ReportActionInput): Promise<ReportItem> => {
  const { data } = await api.patch<{ success: boolean; data: ReportItem }>(
    `/moderation/reports/${id}/action`,
    body
  )
  return data.data
}

export const addReportNote = async (id: string, note: string): Promise<ReportItem> => {
  const { data } = await api.post<{ success: boolean; data: ReportItem }>(
    `/moderation/reports/${id}/notes`,
    { note }
  )
  return data.data
}

export const fetchModerationHistory = async (
  params: HistoryQueryParams = {}
): Promise<ModerationHistoryResponse> => {
  const { data } = await api.get<{ success: boolean; data: ModerationLogItem[]; meta: QueuePaginationMeta }>(
    '/moderation/history',
    { params }
  )
  return { logs: data.data, meta: data.meta }
}

// ─── User Report (public) ──────────────────────────────────────────────────

export const submitUserReport = async (body: CreateReportInput): Promise<ReportItem> => {
  const { data } = await api.post<{ success: boolean; data: ReportItem }>('/reports', body)
  return data.data
}
