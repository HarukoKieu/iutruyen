import { isAxiosError } from 'axios'
import { axiosInstance } from '@/lib/axios'

export interface CrawlStoryMetadata {
  title: string
  description: string
  author: string
  genres: string[]
  status?: 'ongoing' | 'completed' | 'hiatus'
  rawStatus: string
  coverUrl?: string
  coverBase64?: string
  coverWarning?: string
  truncated: boolean
}

export interface CrawlCatalog {
  title: string
  sourceUrl: string
  chapters: { title: string; url: string }[]
  truncated: boolean
  nextCursor: string | null
}
export interface CrawlPreview {
  title: string
  text: string
  wordCount: number
  sourceUrl: string
  previewToken: string
  expiresAt: string
}
export interface CrawlImportInput {
  previewToken: string
  title: string
  order: number
  rightsConfirmed: true
}
export interface CrawlImportResult {
  chapterId: string
  title: string
  order: number
  alreadyImported: boolean
}
export function crawlErrorMessage(error: unknown) {
  if (isAxiosError(error) && error.response?.data?.code === 'CRAWLER_CHAPTER_EXISTS') return 'Chương đã có trong truyện, giữ nguyên nội dung.'
  if (isAxiosError(error) && error.response?.data?.code === 'CRAWLER_STORY_EXISTS') return 'Truyện từ URL nguồn này đã có trên hệ thống. Bạn có thể nhập các chương còn thiếu.'
  return isAxiosError(error) ? error.response?.data?.message || 'Không kết nối được máy chủ. Vui lòng thử lại.'
    : error instanceof Error ? error.message : 'Không thực hiện được thao tác.'
}
const options = { timeout: 45000 }
export const crawlerApi = {
  async metadata(url: string): Promise<{ story: CrawlStoryMetadata; sourceUrl: string }> {
    const { data } = await axiosInstance.post('/stories/crawl/metadata', { url }, { timeout: 95000 })
    return data.data
  },
  async catalog(storyId: string, input: { url: string; cursor?: string }): Promise<CrawlCatalog> {
    const { data } = await axiosInstance.post(`/stories/${storyId}/crawl/catalog`, input, options)
    return { ...data.data, nextCursor: data.meta.nextCursor }
  },
  async preview(storyId: string, url: string): Promise<CrawlPreview> {
    const { data } = await axiosInstance.post(`/stories/${storyId}/crawl/preview`, { url }, options)
    return data.data
  },
  async importChapter(storyId: string, input: CrawlImportInput): Promise<CrawlImportResult> {
    const { data } = await axiosInstance.post(`/stories/${storyId}/crawl/import`, input, options)
    return data.data
  },
}
