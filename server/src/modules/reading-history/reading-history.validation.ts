import { z } from 'zod'

export const upsertReadingHistorySchema = z.object({
  storyId: z.string({ required_error: 'storyId là bắt buộc' }),
  lastChapterId: z.string({ required_error: 'lastChapterId là bắt buộc' }),
  scrollPositionPercent: z.number().min(0).max(100).optional(),
})

export type UpsertReadingHistoryDto = z.infer<typeof upsertReadingHistorySchema>
