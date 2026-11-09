import { z } from 'zod'

export const storyIdParamSchema = z.object({
  storyId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Story ID không hợp lệ'),
})

export const storyAndReviewIdParamSchema = z.object({
  storyId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Story ID không hợp lệ'),
  reviewId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Review ID không hợp lệ'),
})

export const upsertRatingSchema = z.object({
  score: z
    .number({ required_error: 'Điểm đánh giá là bắt buộc' })
    .int('Điểm phải là số nguyên')
    .min(1, 'Điểm tối thiểu là 1 sao')
    .max(5, 'Điểm tối đa là 5 sao'),
})

export const upsertReviewSchema = z.object({
  content: z
    .string({ required_error: 'Nội dung cảm nhận là bắt buộc' })
    .min(50, 'Bài cảm nhận phải có ít nhất 50 ký tự')
    .max(3000, 'Bài cảm nhận không được vượt quá 3000 ký tự'),
})

export const queryReviewsSchema = z.object({
  sort: z.enum(['newest', 'top']).default('newest'),
  cursor: z.string().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export type StoryIdParamDto = z.infer<typeof storyIdParamSchema>
export type StoryAndReviewIdParamDto = z.infer<typeof storyAndReviewIdParamSchema>
export type UpsertRatingDto = z.infer<typeof upsertRatingSchema>
export type UpsertReviewDto = z.infer<typeof upsertReviewSchema>
export type QueryReviewsDto = z.infer<typeof queryReviewsSchema>
