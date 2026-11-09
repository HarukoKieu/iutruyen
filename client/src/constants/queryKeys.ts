import type { SearchStoriesParams } from '@/types/search'

export const queryKeys = {
  auth: {
    currentUser: ['auth', 'currentUser'] as const,
  },
  users: {
    me: ['users', 'me'] as const,
    profile: (id: string) => ['users', 'profile', id] as const,
  },
  stories: {
    all: ['stories'] as const,
    list: (filters?: Record<string, any>) => ['stories', 'list', filters] as const,
    detail: (slug: string) => ['stories', 'detail', slug] as const,
    byId: (id: string) => ['stories', 'byId', id] as const,
    ranking: (period: string, category?: string) => ['stories', 'ranking', period, category] as const,
  },
  chapters: {
    list: (storyId: string) => ['chapters', 'list', storyId] as const,
    detail: (storyId: string, slug: string) => ['chapters', 'detail', storyId, slug] as const,
  },
  crawlerJobs: {
    targets: (actorId: string, q: string) => ['crawler-targets', actorId, q] as const,
    list: (actorId: string) => ['crawler-jobs', actorId, 'list'] as const,
    detail: (actorId: string, jobId: string) => ['crawler-jobs', actorId, 'detail', jobId] as const,
    tasks: (actorId: string, jobId: string, status?: string, cursor?: string) => ['crawler-jobs', actorId, 'tasks', jobId, status, cursor] as const,
  },
  genres: {
    all: ['genres', 'all'] as const,
  },
  tags: {
    all: ['tags', 'all'] as const,
  },
  library: {
    follows: ['library', 'follows'] as const,
    bookmarks: ['library', 'bookmarks'] as const,
    history: ['library', 'history'] as const,
  },
  notifications: {
    all: (unreadOnly?: boolean) => ['notifications', unreadOnly] as const,
  },
  moderation: {
    queue: (type: string) => ['moderation', 'queue', type] as const,
    reports: (status?: string) => ['moderation', 'reports', status] as const,
    reportDetail: (id: string) => ['moderation', 'reportDetail', id] as const,
  },
  admin: {
    scoped: (actorId: string | undefined, name: string, params: object) => ['admin', actorId, name, params] as const,
    overview: ['admin', 'overview'] as const,
    users: (filters?: Record<string, any>) => ['admin', 'users', filters] as const,
    authors: (filters?: Record<string, any>) => ['admin', 'authors', filters] as const,
    auditLogs: (filters?: Record<string, any>) => ['admin', 'auditLogs', filters] as const,
  },
  search: {
    stories: (params?: SearchStoriesParams) => ['search', 'stories', params] as const,
    suggestions: (q: string) => ['search', 'suggestions', q] as const,
    history: ['search', 'history'] as const,
  },
} as const
