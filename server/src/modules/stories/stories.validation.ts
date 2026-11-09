import { z } from 'zod'

const base64ImageRegex = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/
const MAX_COVER_BASE64_LENGTH = 800 * 1024 // ~800KB base64 string

export const createStorySchema = z.object({
  crawlerSourceUrl: z.string().trim().url().max(2048).optional(),
  originalAuthor: z.string().trim().max(200).optional(),
  sourceName: z.string().trim().max(2048).optional(),
  title: z
    .string()
    .min(3, 'Tên truyện phải có ít nhất 3 ký tự')
    .max(150, 'Tên truyện không được vượt quá 150 ký tự')
    .trim(),
  description: z
    .string()
    .min(10, 'Mô tả truyện phải có ít nhất 10 ký tự')
    .max(5000, 'Mô tả truyện không được vượt quá 5000 ký tự')
    .trim(),
  coverBase64: z
    .string()
    .refine((val) => !val || (base64ImageRegex.test(val) && val.length <= MAX_COVER_BASE64_LENGTH), {
      message: 'Ảnh bìa không hợp lệ hoặc kích thước vượt quá 500KB',
    })
    .optional(),
  genreIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID thể loại không hợp lệ'))
    .max(50)
    .min(1, 'Truyện phải thuộc ít nhất 1 thể loại'),
  tagIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID tag không hợp lệ'))
    .max(50)
    .optional()
    .default([]),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).optional().default([]),
  status: z.enum(['ongoing', 'completed', 'hiatus']).optional().default('ongoing'),
  contentWarning: z.enum(['none', 'mature18+']).optional().default('none'),
})

export const updateStorySchema = z.object({
  originalAuthor: z.string().trim().max(200).optional(),
  sourceName: z.string().trim().max(2048).optional(),
  title: z
    .string()
    .min(3, 'Tên truyện phải có ít nhất 3 ký tự')
    .max(150, 'Tên truyện không được vượt quá 150 ký tự')
    .trim()
    .optional(),
  description: z
    .string()
    .min(10, 'Mô tả truyện phải có ít nhất 10 ký tự')
    .max(5000, 'Mô tả truyện không được vượt quá 5000 ký tự')
    .trim()
    .optional(),
  coverBase64: z
    .string()
    .refine((val) => !val || (base64ImageRegex.test(val) && val.length <= MAX_COVER_BASE64_LENGTH), {
      message: 'Ảnh bìa không hợp lệ hoặc kích thước vượt quá 500KB',
    })
    .optional()
    .nullable(),
  genreIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID thể loại không hợp lệ'))
    .max(50)
    .min(1, 'Truyện phải thuộc ít nhất 1 thể loại')
    .optional(),
  tagIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID tag không hợp lệ'))
    .max(50)
    .optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  status: z.enum(['ongoing', 'completed', 'hiatus']).optional(),
  contentWarning: z.enum(['none', 'mature18+']).optional(),
})

export const storyQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  genre: z.string().optional(),
  tag: z.string().optional(),
  status: z.enum(['ongoing', 'completed', 'hiatus']).optional(),
  sort: z
    .enum(['new', 'hot', 'top-week', 'top-month', 'top-year', 'rating', 'chapters'])
    .optional()
    .default('new'),
  q: z.string().optional(),
  author: z.string().optional(),
})

export const rankingQuerySchema = z.object({
  metric: z.enum(['views', 'follows', 'rating', 'chapters']).optional().default('views'),
  period: z.enum(['all', 'month', 'week']).optional().default('all'),
  genre: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
})

export const authorStoriesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  status: z.enum(['ongoing', 'completed', 'hiatus']).optional(),
  sort: z
    .enum(['new', 'hot', 'top-week', 'top-month', 'top-year', 'rating', 'chapters'])
    .optional()
    .default('new'),
})

export const storyIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID truyện không hợp lệ'),
})

export type CreateStoryInput = z.infer<typeof createStorySchema>
export type UpdateStoryInput = z.infer<typeof updateStorySchema>
export type StoryQueryInput = z.infer<typeof storyQuerySchema>
export type RankingQueryInput = z.infer<typeof rankingQuerySchema>
export type AuthorStoriesQueryInput = z.infer<typeof authorStoriesQuerySchema>
export type StoryIdParamInput = z.infer<typeof storyIdParamSchema>

