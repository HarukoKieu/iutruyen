import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchModerationSummary,
  fetchStoryQueue,
  fetchChapterQueue,
  fetchCommentQueue,
  fetchReports,
  fetchReportDetail,
  submitReportAction,
  addReportNote,
  fetchModerationHistory,
  submitUserReport,
  moderateStory,
  moderateChapter,
  moderateComment,
  type QueueQueryParams,
  type ReportsQueryParams,
  type HistoryQueryParams,
} from '../api/moderation.api'
import type { ModerationActionInput, ReportActionInput, CreateReportInput } from '@/types/moderation'

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const moderationKeys = {
  all: ['moderation'] as const,
  summary: () => [...moderationKeys.all, 'summary'] as const,
  storyQueue: (params: QueueQueryParams) => [...moderationKeys.all, 'queue', 'stories', params] as const,
  chapterQueue: (params: QueueQueryParams) => [...moderationKeys.all, 'queue', 'chapters', params] as const,
  commentQueue: (params: QueueQueryParams) => [...moderationKeys.all, 'queue', 'comments', params] as const,
  reports: (params: ReportsQueryParams) => [...moderationKeys.all, 'reports', params] as const,
  reportDetail: (id: string) => [...moderationKeys.all, 'reports', id] as const,
  history: (params: HistoryQueryParams) => [...moderationKeys.all, 'history', params] as const,
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export const useModerationSummary = () => {
  return useQuery({
    queryKey: moderationKeys.summary(),
    queryFn: fetchModerationSummary,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

// ─── Story Queue ──────────────────────────────────────────────────────────────

export const useStoryQueue = (params: QueueQueryParams = {}) => {
  return useInfiniteQuery({
    queryKey: moderationKeys.storyQueue(params),
    queryFn: ({ pageParam }) => fetchStoryQueue({ ...params, cursor: pageParam as string | undefined }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,
  })
}

// ─── Chapter Queue ────────────────────────────────────────────────────────────

export const useChapterQueue = (params: QueueQueryParams = {}) => {
  return useInfiniteQuery({
    queryKey: moderationKeys.chapterQueue(params),
    queryFn: ({ pageParam }) => fetchChapterQueue({ ...params, cursor: pageParam as string | undefined }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,
  })
}

// ─── Comment Queue ────────────────────────────────────────────────────────────

export const useCommentQueue = (params: QueueQueryParams = {}) => {
  return useInfiniteQuery({
    queryKey: moderationKeys.commentQueue(params),
    queryFn: ({ pageParam }) => fetchCommentQueue({ ...params, cursor: pageParam as string | undefined }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,
  })
}

// ─── Moderation Actions ───────────────────────────────────────────────────────

export const useModerateStory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string
      action: 'approve' | 'hide' | 'remove' | 'request_revision'
      body: ModerationActionInput
    }) => moderateStory(id, action, body),
    onSuccess: () => {
      toast.success('Thao tác kiểm duyệt truyện thành công')
      void qc.invalidateQueries({ queryKey: moderationKeys.all })
    },
    onError: () => toast.error('Không thể thực hiện thao tác'),
  })
}

export const useModerateChapter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string
      action: 'approve' | 'hide' | 'remove'
      body: ModerationActionInput
    }) => moderateChapter(id, action, body),
    onSuccess: () => {
      toast.success('Thao tác kiểm duyệt chương thành công')
      void qc.invalidateQueries({ queryKey: moderationKeys.all })
      for (const key of ['stories', 'story', 'story-by-id', 'chapters', 'ranking']) {
        void qc.invalidateQueries({ queryKey: [key] })
      }
    },
    onError: () => toast.error('Không thể thực hiện thao tác'),
  })
}

export const useModerateComment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string
      action: 'approve' | 'hide' | 'delete'
      body: ModerationActionInput
    }) => moderateComment(id, action, body),
    onSuccess: () => {
      toast.success('Thao tác kiểm duyệt bình luận thành công')
      void qc.invalidateQueries({ queryKey: moderationKeys.all })
    },
    onError: () => toast.error('Không thể thực hiện thao tác'),
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export const useReportsList = (params: ReportsQueryParams = {}) => {
  return useInfiniteQuery({
    queryKey: moderationKeys.reports(params),
    queryFn: ({ pageParam }) => fetchReports({ ...params, cursor: pageParam as string | undefined }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,
  })
}

export const useReportDetail = (id: string) => {
  return useQuery({
    queryKey: moderationKeys.reportDetail(id),
    queryFn: () => fetchReportDetail(id),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export const useModerationAction = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReportActionInput }) => submitReportAction(id, body),
    onSuccess: (_data, { id }) => {
      toast.success('Xử lý báo cáo thành công')
      void qc.invalidateQueries({ queryKey: moderationKeys.reportDetail(id) })
      void qc.invalidateQueries({ queryKey: moderationKeys.all })
    },
    onError: () => toast.error('Không thể xử lý báo cáo'),
  })
}

export const useAddReportNote = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => addReportNote(id, note),
    onSuccess: (_data, { id }) => {
      toast.success('Đã thêm ghi chú')
      void qc.invalidateQueries({ queryKey: moderationKeys.reportDetail(id) })
    },
    onError: () => toast.error('Không thể thêm ghi chú'),
  })
}

// ─── Moderation History ────────────────────────────────────────────────────────

export const useModerationHistory = (params: HistoryQueryParams = {}) => {
  return useInfiniteQuery({
    queryKey: moderationKeys.history(params),
    queryFn: ({ pageParam }) =>
      fetchModerationHistory({ ...params, cursor: pageParam as string | undefined }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,
  })
}

// ─── Submit Report (public user action) ──────────────────────────────────────

export const useSubmitReport = () => {
  return useMutation({
    mutationFn: (body: CreateReportInput) => submitUserReport(body),
    onSuccess: () => {
      toast.success('Báo cáo đã được ghi nhận. Cảm ơn bạn!')
    },
    onError: () => {
      toast.error('Không thể gửi báo cáo. Vui lòng thử lại.')
    },
  })
}
