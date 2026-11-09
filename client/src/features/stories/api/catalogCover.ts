import { API_BASE_URL } from '@/lib/apiConfig'
import type { Story } from '@/types/story'

/** Resolve the API-relative cover URL against the configured API, not the UI host. */
export function catalogCover(story: Story): Story {
  const prefix = '/api/v1/'
  if (!story.coverUrl?.startsWith(`${prefix}stories/`)) return story
  return { ...story, coverUrl: `${API_BASE_URL.replace(/\/$/, '')}/${story.coverUrl.slice(prefix.length)}` }
}
