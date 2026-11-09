import { axiosInstance } from '@/lib/axios'
import type { ReadingHistoryItem } from '@/types/reading-history'
import { getPersonalPage } from './personal-page'

export const readingHistoryApi = {
  getPage: (limit: number, cursor: string | null) => getPersonalPage<ReadingHistoryItem>('/reading-history/me', limit, cursor),
  async getUserHistory(limit: number = 20): Promise<ReadingHistoryItem[]> {
    const res = await axiosInstance.get('/reading-history/me', { params: { limit } })
    return res.data.data
  },

  async upsertHistory(storyId: string, lastChapterId: string, scrollPositionPercent?: number): Promise<ReadingHistoryItem> {
    const res = await axiosInstance.put('/reading-history', {
      storyId,
      lastChapterId,
      ...(scrollPositionPercent !== undefined ? { scrollPositionPercent } : {}),
    })
    return res.data.data
  },
}
