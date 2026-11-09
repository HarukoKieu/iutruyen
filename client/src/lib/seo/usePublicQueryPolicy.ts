import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'

interface StoryVisibility {
  moderationStatus?: string
  contentWarning?: string
}
interface ReaderVisibility {
  story?: StoryVisibility
  chapter?: { moderationStatus?: string; status?: string }
}

const matchesKey = (key: QueryKey, expected: QueryKey) => key.length === expected.length && key.every((part, index) => part === expected[index])
const unavailableStory = (story?: StoryVisibility) => !!story && (
  (!!story.moderationStatus && story.moderationStatus !== 'approved') || story.contentWarning === 'mature18+'
)

/** Observe only this resource/session, preserving parent visibility without stale chapter errors. */
export function usePublicQueryPolicy(storySlug: string, chapterSlug: string | undefined, sessionScope: string) {
  const client = useQueryClient()
  const storyKey = useMemo(() => ['story', storySlug] as const, [storySlug])
  const chapterKey = useMemo(() => chapterSlug ? ['chapter', storySlug, chapterSlug, sessionScope] as const : null, [storySlug, chapterSlug, sessionScope])
  const subscribe = useCallback((onChange: () => void) => client.getQueryCache().subscribe(event => {
    if (!storySlug || !['added', 'removed', 'updated'].includes(event.type)) return
    if (matchesKey(event.query.queryKey, storyKey) || (chapterKey && matchesKey(event.query.queryKey, chapterKey))) onChange()
  }), [client, storySlug, storyKey, chapterKey])
  const getSnapshot = useCallback(() => {
    if (!storySlug) return false
    // getQueryState uses the hash lookup; do not scan the whole cache on each event.
    const storyState = client.getQueryState<StoryVisibility>(storyKey)
    if (unavailableStory(storyState?.data)) return true
    if (!chapterKey) return storyState?.status === 'error'
    const chapterState = client.getQueryState<ReaderVisibility>(chapterKey)
    const chapter = chapterState?.data?.chapter
    return chapterState?.status === 'error' || unavailableStory(chapterState?.data?.story) ||
      (!!chapter?.moderationStatus && chapter.moderationStatus !== 'approved') ||
      (!!chapter?.status && chapter.status !== 'published')
  }, [client, storySlug, storyKey, chapterKey])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
