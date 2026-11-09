import { axiosInstance } from '@/lib/axios'
import type { CursorPaginationMeta } from '@/types/story'
import type { CrawlerJob, CrawlerJobAction, CrawlerTarget, CrawlerTask, CrawlerTaskStatus, PrepareCrawlerJobInput } from '@/types/crawler-job'

interface Envelope<T> { data: T; meta: CursorPaginationMeta }
const base = '/stories/crawl/jobs'
const options = { timeout: 45000 }

export const crawlerJobsApi = {
  async targets(q: string, cursor?: string, signal?: AbortSignal) {
    const { data } = await axiosInstance.get<Envelope<CrawlerTarget[]>>('/stories/crawl/targets', { ...options, params: { q: q || undefined, cursor, limit: 20 }, signal })
    return { targets: data.data, meta: data.meta }
  },
  async prepare(input: PrepareCrawlerJobInput): Promise<CrawlerJob> {
    const { data } = await axiosInstance.post<Envelope<CrawlerJob>>(base, input, options)
    return data.data
  },
  async list(cursor?: string, signal?: AbortSignal) {
    const { data } = await axiosInstance.get<Envelope<CrawlerJob[]>>(base, { ...options, params: { cursor, limit: 20 }, signal })
    return { jobs: data.data, meta: data.meta }
  },
  async detail(jobId: string, signal?: AbortSignal): Promise<CrawlerJob> {
    const { data } = await axiosInstance.get<Envelope<CrawlerJob>>(`${base}/${jobId}`, { ...options, signal })
    return data.data
  },
  async tasks(jobId: string, status?: CrawlerTaskStatus, cursor?: string, signal?: AbortSignal) {
    const { data } = await axiosInstance.get<Envelope<CrawlerTask[]>>(`${base}/${jobId}/tasks`, { ...options, params: { cursor, status, limit: 50 }, signal })
    return { tasks: data.data, meta: data.meta }
  },
  async control(jobId: string, action: CrawlerJobAction, rightsConfirmed?: true): Promise<CrawlerJob> {
    const { data } = await axiosInstance.post<Envelope<CrawlerJob>>(`${base}/${jobId}/control`, { action, ...(rightsConfirmed ? { rightsConfirmed } : {}) }, options)
    return data.data
  },
}
