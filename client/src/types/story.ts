import type { Genre } from './genre'
import type { Tag } from './tag'
import type { PublicUserProfile } from './user'

export type StoryStatus = 'ongoing' | 'completed' | 'hiatus'
export type StoryModerationStatus = 'pending' | 'approved' | 'hidden' | 'removed'
export type StoryContentWarning = 'none' | 'mature18+'
export type StorySortOption = 'new' | 'hot' | 'top-week' | 'top-month' | 'top-year' | 'rating' | 'chapters'

export interface Story {
  originalAuthor?: string
  sourceName?: string
  _id: string
  title: string
  slug: string
  description: string
  coverUrl?: string
  authorId: PublicUserProfile
  genreIds: Genre[]
  tagIds: Tag[]
  status: StoryStatus
  moderationStatus: StoryModerationStatus
  contentWarning: StoryContentWarning
  isFeatured?: boolean
  chapterCount: number
  viewCount: number
  followCount: number
  ratingAverage: number
  ratingCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateStoryInput {
  crawlerSourceUrl?: string
  originalAuthor?: string
  sourceName?: string
  title: string
  description: string
  coverBase64?: string
  genreIds: string[]
  tagIds?: string[]
  tags?: string[]
  status?: StoryStatus
  contentWarning?: StoryContentWarning
}

export interface UpdateStoryInput {
  originalAuthor?: string
  sourceName?: string
  title?: string
  description?: string
  coverBase64?: string
  genreIds?: string[]
  tagIds?: string[]
  tags?: string[]
  status?: StoryStatus
  contentWarning?: StoryContentWarning
  isFeatured?: boolean
}

export interface StoryQueryParams {
  cursor?: string
  limit?: number
  genre?: string
  tag?: string
  status?: StoryStatus
  sort?: StorySortOption
  q?: string
  author?: string
}

export interface CursorPaginationMeta {
  limit: number
  nextCursor: string | null
  hasMore: boolean
}

export interface StoriesResponse {
  success: boolean
  data: Story[]
  meta: CursorPaginationMeta
}

export interface StoryResponse {
  success: boolean
  data: Story
  message?: string
}

export interface StoryStats {
  id: string
  title: string
  viewCount: number
  followCount: number
  ratingAverage: number
  ratingCount: number
  chapterCount: number
}
