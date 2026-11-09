import { z } from 'zod'

export const createBookmarkSchema = z.object({
  chapterId: z.string({ required_error: 'chapterId là bắt buộc' }),
  note: z.string().max(500, 'Ghi chú không được vượt quá 500 ký tự').optional(),
})

export type CreateBookmarkDto = z.infer<typeof createBookmarkSchema>
