export interface BookmarkItem {
  _id: string
  userId: string
  chapterId: {
    _id: string
    title: string
    slug: string
    order: number
    storyId?: {
      _id: string
      title: string
      slug: string
      coverUrl?: string
    }
  }
  note?: string
  createdAt: string
}
