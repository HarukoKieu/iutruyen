export type CrawlerJobStatus = 'planning' | 'ready' | 'queued' | 'running' | 'paused' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled'
export type CrawlerTaskStatus = 'pending' | 'succeeded' | 'skipped' | 'failed'
export type CrawlerJobAction = 'start' | 'pause' | 'resume' | 'cancel' | 'retry'
export interface CrawlerTarget { id: string; title: string }

export interface CrawlerJobSourceInput {
  url: string
  storyId?: string
  genreIds?: string[]
  from: number
  to?: number
  startOrder: number
}

export interface PrepareCrawlerJobInput {
  requestKey: string
  sources: CrawlerJobSourceInput[]
}

export interface CrawlerJobSource {
  url: string
  destination: 'new' | 'existing'
  reusedExisting?: boolean
  skipReason?: 'CRAWLER_STORY_EXISTS'
  storyId?: string
  genreIds: string[]
  from: number
  to?: number
  startOrder: number
  metadata?: {
    title: string
    description: string
    originalAuthor?: string
    sourceName?: string
    coverUrl?: string
    status?: 'ongoing' | 'completed' | 'hiatus'
    genres?: string[]
  }
  discovery: { nextUrl?: string; pageCount: number; chapterCount: number; complete: boolean }
  errorCode?: string
  warning?: string
  counters?: { total: number; pending: number; succeeded: number; skipped: number; failed: number }
}

export interface CrawlerJob {
  id: string
  actorId: string
  status: CrawlerJobStatus
  phase: 'planning' | 'importing'
  active: boolean
  counters: { total: number; pending: number; succeeded: number; skipped: number; failed: number }
  sources: CrawlerJobSource[]
  createdAt: string
  updatedAt: string
  finishedAt?: string
  errorCode?: string
}

export interface CrawlerTask {
  id: string
  sourceIndex: number
  url: string
  title: string
  position: number
  order: number
  status: CrawlerTaskStatus
  attempts: number
  errorCode?: string
  chapterId?: string
}
