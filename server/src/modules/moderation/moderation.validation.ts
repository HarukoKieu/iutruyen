import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const queueQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  genre: z.string().optional(),
  sort: z.enum(['oldest', 'newest']).optional().default('oldest'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

export const moderationActionSchema = z.object({
  reason: z.string().trim().max(300).optional(),
  note: z.string().trim().max(1000).optional(),
  notifyUser: z.boolean().optional().default(true),
})

export const createReportSchema = z.object({
  targetType: z.enum(['story', 'chapter', 'comment', 'user'], {
    message: 'targetType phải là story, chapter, comment hoặc user',
  }),
  targetId: z.string().regex(objectIdRegex, { message: 'targetId không hợp lệ' }),
  reason: z.string().trim().min(2, { message: 'Lý do báo cáo phải có ít nhất 2 ký tự' }).max(200),
  description: z.string().trim().max(1000).optional(),
  evidenceUrls: z.array(z.string().url({ message: 'URL bằng chứng không hợp lệ' })).max(5).optional(),
})

export const reportActionSchema = z.object({
  action: z.enum(
    ['dismiss', 'request_revision', 'hide', 'remove', 'warn_user'],
    { message: 'Hành động không hợp lệ' }
  ),
  note: z.string().trim().max(1000).optional(),
  notifyUser: z.boolean().optional().default(true),
})

export const addReportNoteSchema = z.object({
  note: z.string().trim().min(1, { message: 'Ghi chú không được để trống' }).max(1000),
})

export const reportsQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'resolved', 'dismissed']).optional(),
  targetType: z.enum(['story', 'chapter', 'comment', 'user']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

export const historyQuerySchema = z.object({
  action: z.string().trim().optional(),
  targetType: z.enum(['story', 'chapter', 'comment', 'user', 'report']).optional(),
  moderatorId: z.string().regex(objectIdRegex).optional(),
  range: z.enum(['24h', '7d', '30d', 'all']).optional().default('all'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

export const targetIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, { message: 'ID không hợp lệ' }),
})

export const storyActionParamSchema = targetIdParamSchema.extend({
  action: z.enum(['approve', 'hide', 'remove', 'request_revision']),
})
export const chapterActionParamSchema = targetIdParamSchema.extend({
  action: z.enum(['approve', 'hide', 'remove']),
})
export const commentActionParamSchema = targetIdParamSchema.extend({
  action: z.enum(['approve', 'hide', 'delete']),
})

export type QueueQueryDto = z.infer<typeof queueQuerySchema>
export type ModerationActionDto = z.infer<typeof moderationActionSchema>
export type CreateReportDto = z.infer<typeof createReportSchema>
export type ReportActionDto = z.infer<typeof reportActionSchema>
export type AddReportNoteDto = z.infer<typeof addReportNoteSchema>
export type ReportsQueryDto = z.infer<typeof reportsQuerySchema>
export type HistoryQueryDto = z.infer<typeof historyQuerySchema>
export type TargetIdParamDto = z.infer<typeof targetIdParamSchema>
