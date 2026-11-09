import { z } from 'zod'

const url = z.string().trim().url().max(2048)
export const crawlParamsSchema = z.object({ storyId: z.string().regex(/^[a-f\d]{24}$/i, 'ID truyện không hợp lệ') })
export const crawlCatalogSchema = z.object({ url, cursor: z.string().max(100).optional() }).strict()
export const crawlPreviewSchema = z.object({ url }).strict()
export const crawlImportSchema = z.object({
  previewToken: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  order: z.number().int().min(1).max(1_000_000),
  rightsConfirmed: z.literal(true),
}).strict()
export type CrawlImportInput = z.infer<typeof crawlImportSchema>
