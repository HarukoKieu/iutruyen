/**
 * SEO Validation — Phase 8
 * Zod schemas cho các query params của SEO endpoints.
 */
import { z } from 'zod'

export const storySlugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug chỉ chứa ký tự a-z, 0-9, dấu gạch ngang'),
})

export const chapterSlugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Story slug không hợp lệ'),
  chapterSlug: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9-]+$/, 'Chapter slug không hợp lệ'),
})

export const tocQuerySchema = z.object({
  cursor: z.string().max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const coverParamSchema = z.object({
  storyId: z
    .string()
    .regex(/^[0-9a-f]{24}$/i, 'storyId phải là MongoDB ObjectId'),
})

export const sitemapShardParamSchema = z.object({
  generation: z
    .string()
    .regex(/^[0-9a-f]{16}$/, 'generation không hợp lệ'),
  kind: z.enum(['stories', 'chapters']),
  shard: z.coerce.number().int().min(0).max(9999),
})

export const catalogKindParamSchema = z.object({
  kind: z.enum(['home', 'stories', 'ranking']),
})

export type StorySlugParam = z.infer<typeof storySlugParamSchema>
export type ChapterSlugParam = z.infer<typeof chapterSlugParamSchema>
export type TocQuery = z.infer<typeof tocQuerySchema>
export type CoverParam = z.infer<typeof coverParamSchema>
export type SitemapShardParam = z.infer<typeof sitemapShardParamSchema>
export type CatalogKindParam = z.infer<typeof catalogKindParamSchema>
