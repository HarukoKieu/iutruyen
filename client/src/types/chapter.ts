import type { StoryModerationStatus } from './story'

export type ChapterStatus = 'draft' | 'scheduled' | 'published'

export interface Chapter {
  _id: string
  storyId: string | { _id: string; title: string; slug: string; authorId: string; chapterCount: number }
  title: string
  slug: string
  order: number
  contentHtml: string
  status: ChapterStatus
  moderationStatus?: 'pending' | 'approved' | 'hidden'
  wordCount?: number
  publishAt?: string
  viewCount: number
  createdAt: string
  updatedAt: string
}

export interface ChapterListItem {
  _id: string
  storyId: string
  title: string
  slug: string
  order: number
  status: ChapterStatus
  moderationStatus?: Chapter['moderationStatus']
  publishAt?: string
  viewCount: number
  createdAt: string
}

export interface ChapterNavInfo {
  _id: string
  title: string
  slug: string
  order: number
}

export interface ChapterDetailResponse {
  chapter: Chapter
  story: {
    _id: string
    title: string
    slug: string
    authorId: string | { _id: string; displayName?: string; username?: string }
    chapterCount: number
    genreIds?: Array<{ _id?: string; slug?: string; name: string }>
    contentWarning: 'none' | 'mature18+'
    moderationStatus?: StoryModerationStatus
  }
  prevChapter: ChapterNavInfo | null
  nextChapter: ChapterNavInfo | null
}

export interface CreateChapterInput {
  title: string
  contentHtml: string
  status?: ChapterStatus
  publishAt?: string
  order?: number
}

export interface UpdateChapterInput {
  title?: string
  contentHtml?: string
  status?: ChapterStatus
  publishAt?: string
  order?: number
}
