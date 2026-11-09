import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/constants/queryKeys'
import type { CrawlerJobAction, CrawlerJobStatus, CrawlerTaskStatus } from '@/types/crawler-job'
import { crawlerJobsApi } from '../api/crawler-jobs.api'
import { crawlErrorMessage } from '../api/crawler.api'
import { isCrawlerJobWorking } from '../utils/crawlerJobPresentation'

function usePageVisible() {
  const [isVisible, setIsVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  useEffect(() => {
    const handleVisibility = () => setIsVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])
  return isVisible
}

/** Find lightweight destinations by title without downloading story content or covers. */
export function useCrawlerTargets(actorId: string, q: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.crawlerJobs.targets(actorId, q),
    queryFn: ({ pageParam, signal }) => crawlerJobsApi.targets(q, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.meta.hasMore ? page.meta.nextCursor ?? undefined : undefined,
    enabled: !!actorId, retry: false, staleTime: 120000,
  })
}

/** List durable import jobs, refreshing active work only while the page is visible. */
export function useCrawlerJobs(actorId: string) {
  const isVisible = usePageVisible()
  return useInfiniteQuery({
    queryKey: queryKeys.crawlerJobs.list(actorId),
    queryFn: ({ pageParam, signal }) => crawlerJobsApi.list(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.meta.hasMore ? page.meta.nextCursor ?? undefined : undefined,
    enabled: !!actorId, retry: false, refetchOnWindowFocus: true,
    maxPages: 3,
    refetchInterval: query => isVisible && query.state.data?.pages.some(page => page.jobs.some(job => isCrawlerJobWorking(job.status))) ? 5000 : false,
    refetchIntervalInBackground: false,
  })
}

/** Load one selected job independently of list pagination so reload can resume its view. */
export function useCrawlerJob(actorId: string, jobId: string) {
  const isVisible = usePageVisible()
  return useQuery({
    queryKey: queryKeys.crawlerJobs.detail(actorId, jobId),
    queryFn: ({ signal }) => crawlerJobsApi.detail(jobId, signal),
    enabled: !!actorId && !!jobId, retry: false, refetchOnWindowFocus: true,
    refetchInterval: query => isVisible && query.state.data && isCrawlerJobWorking(query.state.data.status) ? 5000 : false,
    refetchIntervalInBackground: false,
  })
}

/** Fetch chapter results through cursors and keep filters isolated in the query cache. */
export function useCrawlerJobTasks(actorId: string, jobId: string, jobStatus: CrawlerJobStatus, status?: CrawlerTaskStatus, cursor?: string) {
  const isVisible = usePageVisible()
  const client = useQueryClient()
  useEffect(() => {
    // The final catalog page or task outcome may commit after the last timed refresh.
    // Refresh the visible page once before ready/paused/finished work stops polling,
    // and mark other filters/pages stale so returning to them also gets fresh results.
    if (isVisible && !isCrawlerJobWorking(jobStatus)) {
      void client.invalidateQueries({ queryKey: ['crawler-jobs', actorId, 'tasks', jobId] })
    }
  }, [client, actorId, jobId, jobStatus, isVisible])
  return useQuery({
    queryKey: queryKeys.crawlerJobs.tasks(actorId, jobId, status, cursor),
    queryFn: ({ signal }) => crawlerJobsApi.tasks(jobId, status, cursor, signal),
    enabled: !!actorId && !!jobId, retry: false, refetchOnWindowFocus: true,
    refetchInterval: isVisible && isCrawlerJobWorking(jobStatus) ? 5000 : false,
    refetchIntervalInBackground: false,
  })
}

/** Prepare a plan without saving stories or chapters. The caller retains the retry key. */
export function usePrepareCrawlerJob(actorId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: crawlerJobsApi.prepare,
    onError: error => toast.error(crawlErrorMessage(error)),
    onSuccess: job => {
      client.setQueryData(queryKeys.crawlerJobs.detail(actorId, job.id), job)
      void client.invalidateQueries({ queryKey: queryKeys.crawlerJobs.list(actorId) })
    },
  })
}

/** Apply a permitted job action and refresh its durable status and chapter results. */
export function useControlCrawlerJob(actorId: string, jobId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { action: CrawlerJobAction; rightsConfirmed?: true }) => crawlerJobsApi.control(jobId, input.action, input.rightsConfirmed),
    onError: error => toast.error(crawlErrorMessage(error)),
    onSuccess: job => {
      client.setQueryData(queryKeys.crawlerJobs.detail(actorId, jobId), job)
      void client.invalidateQueries({ queryKey: queryKeys.crawlerJobs.list(actorId) })
      void client.invalidateQueries({ queryKey: ['crawler-jobs', actorId, 'tasks', jobId] })
      void client.invalidateQueries({ queryKey: ['author-stories'] })
      job.sources.forEach(source => {
        if (source.storyId) void client.invalidateQueries({ queryKey: ['chapters', source.storyId] })
      })
    },
  })
}
