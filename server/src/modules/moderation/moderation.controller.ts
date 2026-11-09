import { Request, Response } from 'express'
import { asyncHandler } from '../../common/asyncHandler.js'
import { ApiResponse } from '../../common/ApiResponse.js'
import { moderationService } from './moderation.service.js'
import type {
  QueueQueryDto,
  ModerationActionDto,
  CreateReportDto,
  ReportActionDto,
  AddReportNoteDto,
  ReportsQueryDto,
  HistoryQueryDto,
} from './moderation.validation.js'

export const moderationController = {
  // ─── Summary ───────────────────────────────────────────────────────────────
  getSummary: asyncHandler(async (_req: Request, res: Response) => {
    const summary = await moderationService.getQueueSummary()
    return ApiResponse.success(res, summary, {
      message: 'Lấy thống kê hàng đợi kiểm duyệt thành công',
    })
  }),

  // ─── Story Queue ───────────────────────────────────────────────────────────
  getStoryQueue: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as QueueQueryDto
    const { stories, meta } = await moderationService.getStoryQueue(query)
    return ApiResponse.success(res, stories, {
      message: 'Lấy hàng đợi kiểm duyệt truyện thành công',
      meta,
    })
  }),

  moderateStory: asyncHandler(async (req: Request, res: Response) => {
    const modId = req.user!.id
    const storyId = req.params.id as string
    const action = req.params.action as 'approve' | 'hide' | 'remove' | 'request_revision'
    const body = req.body as ModerationActionDto

    const updatedStory = await moderationService.moderateStory(modId, storyId, action, body)
    return ApiResponse.success(res, updatedStory, {
      message: `Thao tác ${action} truyện thành công`,
    })
  }),

  // ─── Chapter Queue ─────────────────────────────────────────────────────────
  getChapterQueue: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as QueueQueryDto
    const { chapters, meta } = await moderationService.getChapterQueue(query)
    return ApiResponse.success(res, chapters, {
      message: 'Lấy hàng đợi kiểm duyệt chương thành công',
      meta,
    })
  }),

  moderateChapter: asyncHandler(async (req: Request, res: Response) => {
    const modId = req.user!.id
    const chapterId = req.params.id as string
    const action = req.params.action as 'approve' | 'hide' | 'remove'
    const body = req.body as ModerationActionDto

    const updatedChapter = await moderationService.moderateChapter(modId, chapterId, action, body)
    return ApiResponse.success(res, updatedChapter, {
      message: `Thao tác ${action} chương thành công`,
    })
  }),

  // ─── Comment Queue ─────────────────────────────────────────────────────────
  getCommentQueue: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as QueueQueryDto
    const { comments, meta } = await moderationService.getCommentQueue(query)
    return ApiResponse.success(res, comments, {
      message: 'Lấy hàng đợi kiểm duyệt bình luận thành công',
      meta,
    })
  }),

  moderateComment: asyncHandler(async (req: Request, res: Response) => {
    const modId = req.user!.id
    const commentId = req.params.id as string
    const action = req.params.action as 'approve' | 'hide' | 'delete'
    const body = req.body as ModerationActionDto

    const updatedComment = await moderationService.moderateComment(modId, commentId, action, body)
    return ApiResponse.success(res, updatedComment, {
      message: `Thao tác ${action} bình luận thành công`,
    })
  }),

  // ─── Reports ───────────────────────────────────────────────────────────────
  createReport: asyncHandler(async (req: Request, res: Response) => {
    const reporterId = req.user!.id
    const body = req.body as CreateReportDto
    const report = await moderationService.createReport(reporterId, body)
    return ApiResponse.created(res, report, 'Gửi báo cáo vi phạm thành công')
  }),

  getReports: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ReportsQueryDto
    const { reports, meta } = await moderationService.getReports(query)
    return ApiResponse.success(res, reports, {
      message: 'Lấy danh sách báo cáo vi phạm thành công',
      meta,
    })
  }),

  getReportDetail: asyncHandler(async (req: Request, res: Response) => {
    const reportId = req.params.id as string
    const detail = await moderationService.getReportDetail(reportId)
    return ApiResponse.success(res, detail, {
      message: 'Lấy chi tiết báo cáo thành công',
    })
  }),

  actionReport: asyncHandler(async (req: Request, res: Response) => {
    const modId = req.user!.id
    const reportId = req.params.id as string
    const body = req.body as ReportActionDto

    const resolved = await moderationService.actionReport(modId, reportId, body)
    return ApiResponse.success(res, resolved, {
      message: 'Xử lý báo cáo thành công',
    })
  }),

  addReportNote: asyncHandler(async (req: Request, res: Response) => {
    const modId = req.user!.id
    const reportId = req.params.id as string
    const body = req.body as AddReportNoteDto

    const updated = await moderationService.addReportNote(modId, reportId, body.note)
    return ApiResponse.success(res, updated, {
      message: 'Thêm ghi chú thành công',
    })
  }),

  assignReport: asyncHandler(async (req: Request, res: Response) => {
    const modId = req.user!.id
    const reportId = req.params.id as string
    const targetModId = req.body.assignedTo as string | undefined

    const updated = await moderationService.assignReport(modId, reportId, targetModId)
    return ApiResponse.success(res, updated, {
      message: 'Gán xử lý báo cáo thành công',
    })
  }),

  // ─── Moderation History ─────────────────────────────────────────────────────
  getModerationHistory: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as HistoryQueryDto
    const { logs, meta } = await moderationService.getModerationHistory(query)
    return ApiResponse.success(res, logs, {
      message: 'Lấy lịch sử kiểm duyệt thành công',
      meta,
    })
  }),
}
