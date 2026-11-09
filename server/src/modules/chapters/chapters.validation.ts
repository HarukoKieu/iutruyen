import { z } from 'zod'

export const chapterListQuerySchema = z.object({
  chapterId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Chapter ID không hợp lệ').optional(),
  cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().trim().max(100).optional(),
})
export type ChapterListQuery = z.infer<typeof chapterListQuerySchema>

export const createChapterSchema = z.object({
  title: z
    .string({ required_error: 'Tiêu đề chương là bắt buộc' })
    .min(1, 'Tiêu đề chương không được để trống')
    .max(200, 'Tiêu đề chương không được vượt quá 200 ký tự'),
  contentHtml: z
    .string({ required_error: 'Nội dung chương là bắt buộc' })
    .min(10, 'Nội dung chương phải có ít nhất 10 ký tự'),
  status: z.enum(['draft', 'scheduled', 'published']).default('draft'),
  publishAt: z.coerce.date().optional(),
  order: z.number().int().positive().safe().optional(),
}).refine(input => input.status !== 'scheduled' || !!input.publishAt, { path: ['publishAt'], message: 'Chương hẹn giờ phải có ngày xuất bản' })

export const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contentHtml: z.string().min(10).optional(),
  status: z.enum(['draft', 'scheduled', 'published']).optional(),
  publishAt: z.coerce.date().optional(),
  order: z.number().int().positive().safe().optional(),
})

export type CreateChapterDto = z.infer<typeof createChapterSchema>
export type UpdateChapterDto = z.infer<typeof updateChapterSchema>
