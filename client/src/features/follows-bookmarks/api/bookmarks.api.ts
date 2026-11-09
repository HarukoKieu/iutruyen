import { axiosInstance } from '@/lib/axios'
import type { BookmarkItem } from '@/types/bookmark'
import { getPersonalPage } from './personal-page'

export const bookmarksApi = {
  getPage: (limit: number, cursor: string | null) => getPersonalPage<BookmarkItem>('/bookmarks/me', limit, cursor),
  async getUserBookmarks(): Promise<BookmarkItem[]> {
    const res = await axiosInstance.get('/bookmarks/me')
    return res.data.data
  },

  async createBookmark(chapterId: string, note?: string): Promise<BookmarkItem> {
    const res = await axiosInstance.post('/bookmarks', { chapterId, note })
    return res.data.data
  },

  async deleteBookmark(bookmarkId: string): Promise<void> {
    await axiosInstance.delete(`/bookmarks/${bookmarkId}`)
  },

  async checkBookmark(chapterId: string): Promise<{ bookmarked: boolean; bookmark?: BookmarkItem }> {
    const res = await axiosInstance.get(`/bookmarks/check/${chapterId}`)
    return res.data.data
  },
}
