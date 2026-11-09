import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'ID không hợp lệ')
const sourceSchema = z.object({
  url: z.string().trim().url().max(2048),
  storyId: objectId.optional(),
  genreIds: z.array(objectId).min(1).max(20).optional(),
  from: z.number().int().min(1).max(2000).default(1),
  to: z.number().int().min(1).max(2000).default(2000),
  startOrder: z.number().int().min(1).max(1_000_000).default(1),
}).strict().superRefine((source, ctx) => {
  if (source.storyId && source.genreIds) ctx.addIssue({ code: 'custom', path: ['genreIds'], message: 'Truyện hiện hữu giữ nguyên thể loại' })
  if (source.to < source.from) ctx.addIssue({ code: 'custom', path: ['to'], message: 'Chương kết thúc phải lớn hơn hoặc bằng chương bắt đầu' })
  if (source.startOrder + source.to - source.from > 1_000_000) ctx.addIssue({ code: 'custom', path: ['startOrder'], message: 'Thứ tự chương vượt giới hạn' })
})

export const crawlerJobCreateSchema = z.object({
  requestKey: z.string().uuid(), sources: z.array(sourceSchema).min(1).max(20),
}).strict().superRefine((input, ctx) => {
  const urls = input.sources.map(source => {
    try { const url = new URL(source.url); url.hash = ''; return url.href } catch { return source.url }
  })
  if (new Set(urls).size !== urls.length) ctx.addIssue({ code: 'custom', path: ['sources'], message: 'URL truyện bị lặp trong đợt nhập' })
  const targets = input.sources.flatMap(source => source.storyId ? [source.storyId.toLowerCase()] : [])
  if (new Set(targets).size !== targets.length) ctx.addIssue({ code: 'custom', path: ['sources'], message: 'Mỗi truyện đích chỉ được chọn một lần trong đợt nhập' })
})
export const crawlerJobParamsSchema = z.object({ jobId: objectId }).strict()
export const crawlerJobsQuerySchema = z.object({
  cursor: z.string().max(1000).optional(), limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict()
export const crawlerTasksQuerySchema = z.object({
  cursor: z.string().max(1000).optional(), limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['pending', 'succeeded', 'skipped', 'failed']).optional(),
}).strict()
export const crawlerTargetsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(), cursor: z.string().max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict()
export const crawlerJobControlSchema = z.object({
  action: z.enum(['start', 'pause', 'resume', 'cancel', 'retry']), rightsConfirmed: z.literal(true).optional(),
}).strict().superRefine((input, ctx) => {
  if (input.action === 'start' && !input.rightsConfirmed) ctx.addIssue({ code: 'custom', path: ['rightsConfirmed'], message: 'Cần xác nhận quyền sử dụng nội dung' })
})
export type CrawlerJobCreateInput = z.infer<typeof crawlerJobCreateSchema>
export type CrawlerJobControlInput = z.infer<typeof crawlerJobControlSchema>
export type CrawlerJobsQuery = z.infer<typeof crawlerJobsQuerySchema>
export type CrawlerTasksQuery = z.infer<typeof crawlerTasksQuerySchema>
export type CrawlerTargetsQuery = z.infer<typeof crawlerTargetsQuerySchema>
