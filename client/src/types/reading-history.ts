export interface ReadingHistoryItem {
  _id?: string
  userId?: string
  storyId: {
    _id: string
    title: string
    slug: string
    coverUrl?: string
    chapterCount?: number
    status?: string
    authorId?: string | { _id: string; displayName?: string; username?: string }
  } | string
  lastChapterId: {
    _id: string
    title: string
    slug: string
    order: number
  } | string
  lastReadAt: string
  // Local storage cache fields
  storySlug?: string
  storyTitle?: string
  coverUrl?: string
  chapterId?: string
  chapterNumber?: number
  chapterTitle?: string
  totalChapters?: number
  progressPercent?: number
  scrollPositionPercent?: number
}
