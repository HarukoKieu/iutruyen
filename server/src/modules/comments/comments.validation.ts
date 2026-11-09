import { z } from 'zod'

export const commentIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID bình luận không hợp lệ'),
})

export const createCommentSchema = z.object({
  storyId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'storyId không hợp lệ'),
  chapterId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'chapterId không hợp lệ')
    .optional()
    .nullable(),
  parentId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'parentId không hợp lệ')
    .optional()
    .nullable(),
  content: z
    .string({ required_error: 'Nội dung bình luận là bắt buộc' })
    .min(1, 'Nội dung bình luận không được để trống')
    .max(1000, 'Bình luận không được vượt quá 1000 ký tự'),
})

export const updateCommentSchema = z.object({
  content: z
    .string({ required_error: 'Nội dung bình luận là bắt buộc' })
    .min(1, 'Nội dung bình luận không được để trống')
    .max(1000, 'Bình luận không được vượt quá 1000 ký tự'),
})

export const queryCommentsSchema = z.object({
  storyId: z.string().min(1, 'storyId là bắt buộc'),
  chapterId: z.string().optional().nullable(),
  sort: z.enum(['newest', 'top']).default('newest'),
  cursor: z.string().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const queryRepliesSchema = z.object({
  cursor: z.string().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type CommentIdParamDto = z.infer<typeof commentIdParamSchema>
export type CreateCommentDto = z.infer<typeof createCommentSchema>
export type UpdateCommentDto = z.infer<typeof updateCommentSchema>
export type QueryCommentsDto = z.infer<typeof queryCommentsSchema>
export type QueryRepliesDto = z.infer<typeof queryRepliesSchema>
