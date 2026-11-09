import { z } from 'zod'

export const searchStoriesQuerySchema = z.object({
  q: z.string().trim().max(150, 'Từ khóa tìm kiếm không vượt quá 150 ký tự').optional(),
  cursor: z.string().optional().nullable(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit tối thiểu là 1')
    .max(50, 'Limit tối đa là 50')
    .optional()
    .default(20),
  genre: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'ID thể loại không hợp lệ')
    .optional(),
  status: z.enum(['ongoing', 'completed', 'hiatus']).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  sort: z
    .enum(['relevance', 'views', 'rating', 'newest', 'chapters'])
    .optional()
    .default('relevance'),
})

export const searchSuggestionsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
})

export const deleteSearchHistoryQuerySchema = z.object({
  q: z.string().trim().optional(),
})

export type SearchStoriesQuery = z.infer<typeof searchStoriesQuerySchema>
export type SearchSuggestionsQuery = z.infer<typeof searchSuggestionsQuerySchema>
export type DeleteSearchHistoryQuery = z.infer<typeof deleteSearchHistoryQuerySchema>
