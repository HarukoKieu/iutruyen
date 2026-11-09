import { axiosInstance } from '@/lib/axios'
import type {
  ChapterListItem,
  ChapterDetailResponse,
  CreateChapterInput,
  UpdateChapterInput,
  Chapter,
} from '@/types/chapter'

export const chaptersApi = {
  async getChaptersByStory(storyId: string, params: { chapterId?: string; cursor?: string | null; sort?: 'asc' | 'desc'; q?: string } = {}): Promise<{ items: ChapterListItem[]; meta: { hasMore: boolean; nextCursor: string | null; limit: number } }> {
    const res = await axiosInstance.get(`/stories/${storyId}/chapters`, { params: { ...params, limit: 50 } })
    return { items: res.data.data, meta: res.data.meta }
  },

  async getChapterBySlug(storyId: string, slug: string): Promise<ChapterDetailResponse> {
    const res = await axiosInstance.get(`/stories/${storyId}/chapters/${slug}`)
    return res.data.data
  },

  async getChapterPreview(chapterId: string): Promise<Chapter> {
    const res = await axiosInstance.get(`/chapters/${chapterId}/preview`)
    return res.data.data
  },

  async createChapter(storyId: string, input: CreateChapterInput): Promise<Chapter> {
    const res = await axiosInstance.post(`/stories/${storyId}/chapters`, input)
    return res.data.data
  },

  async updateChapter(chapterId: string, input: UpdateChapterInput): Promise<Chapter> {
    const res = await axiosInstance.patch(`/chapters/${chapterId}`, input)
    return res.data.data
  },

  async deleteChapter(chapterId: string): Promise<void> {
    await axiosInstance.delete(`/chapters/${chapterId}`)
  },
}
