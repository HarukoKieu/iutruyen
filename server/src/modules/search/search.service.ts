import { Types } from 'mongoose'
import {
  storyRepository,
  type QuickSuggestionStory,
} from '../../repositories/story.repository.js'
import { genreRepository } from '../../repositories/genre.repository.js'
import { searchHistoryRepository } from '../../repositories/search-history.repository.js'
import { redis } from '../../config/redis.js'
import { logger } from '../../common/logger.js'
import { SearchStoriesQuery } from './search.validation.js'

export interface SuggestionsResponse {
  history: string[]
  suggestions: string[]
  stories: Array<{
    _id: string
    title: string
    slug: string
    coverUrl?: string
    ratingAverage: number
    viewCount: number
    status: string
    author?: {
      displayName: string
      username: string
    }
    genres?: Array<{
      name: string
      slug: string
    }>
  }>
  trending: string[]
}

const DEFAULT_TRENDING = [
  'Tiên Hiệp',
  'Huyền Huyễn',
  'Đô Thị',
  'Khoa Huyễn',
  'Võng Du',
  'Ngôn Tình',
  'Trọng Sinh',
  'Hệ Thống',
]

export const searchStories = async (
  params: SearchStoriesQuery,
  userId?: string
) => {
  let genreId: string | undefined
  if (params.genre) {
    if (Types.ObjectId.isValid(params.genre)) {
      genreId = params.genre
    } else {
      const g = await genreRepository.findBySlug(params.genre)
      if (g) genreId = g._id.toString()
    }
  }

  const result = await storyRepository.searchStories({
    q: params.q,
    genreId,
    status: params.status,
    rating: params.rating,
    sort: params.sort,
    cursor: params.cursor,
    limit: params.limit || 20,
  })

  // Record search history for logged in user asynchronously
  if (userId && params.q && params.q.trim().length >= 2) {
    searchHistoryRepository
      .upsert(userId, params.q.trim())
      .catch((err) => logger.warn('Failed to record search history:', err))
  }

  return result
}

export const getSuggestions = async (
  q: string = '',
  userId?: string
): Promise<SuggestionsResponse> => {
  const normalizedQ = q.trim().toLowerCase()
  const cacheKey = `cache:search:sug:${encodeURIComponent(normalizedQ)}`

  // 1. Fetch user search history if authenticated
  let history: string[] = []
  if (userId) {
    try {
      const historyDocs = await searchHistoryRepository.findByUserId(userId, 5)
      history = historyDocs.map((h) => h.query)
    } catch (err) {
      logger.warn('Failed to get user search history for suggestions:', err)
    }
  }

  // 2. Try getting cached public suggestions (stories + suggestions + trending)
  type CachedCandidates = { stories: Array<{ _id: string }> }
  let cachedData: CachedCandidates | null = null

  if (redis.status === 'ready') {
    try {
      const cachedStr = await redis.get(cacheKey)
      if (cachedStr) {
        const parsed: unknown = JSON.parse(cachedStr)
        if (parsed && typeof parsed === 'object' && 'stories' in parsed && Array.isArray(parsed.stories) &&
          parsed.stories.every(story => story && typeof story === 'object' && typeof story._id === 'string')) {
          cachedData = parsed as CachedCandidates
        }
      }
    } catch (err) {
      logger.warn('Redis read error for search suggestions:', err)
    }
  }

  // Cached candidates are rehydrated under the current public visibility rule.
  // Never return cached title/cover/phrases after hide or edit-to-pending.
  let matchedStories: QuickSuggestionStory[] = []
  let suggestionsList: string[] = []
  if (cachedData && Array.isArray(cachedData.stories)) {
    matchedStories = await storyRepository.findPublicSuggestionsByIds(cachedData.stories.map(story => story._id))
  } else {
    matchedStories = await storyRepository.findQuickSuggestions(normalizedQ, 5)
  }

  // Build autocomplete phrase suggestions from matching author names and story titles
  if (normalizedQ) {
    const authorMatches = matchedStories
      .map((s) => {
        const author = s.authorId
        return author?.displayName || author?.username
      })
      .filter((name): name is string => Boolean(name && name.toLowerCase().includes(normalizedQ)))

    const uniqueAuthors = Array.from(new Set(authorMatches))
    const storyTitles = matchedStories
      .map((s) => s.title)
      .filter((title) => Boolean(title))

    suggestionsList = Array.from(new Set([...uniqueAuthors, ...storyTitles])).slice(0, 5)
  }

  const formattedStories = matchedStories.map((s) => ({
    _id: s._id.toString(),
    title: s.title,
    slug: s.slug,
    coverUrl: s.coverUrl,
    ratingAverage: s.ratingAverage || 0,
    viewCount: s.viewCount || 0,
    status: s.status,
    author: s.authorId
      ? {
          displayName: s.authorId.displayName || s.authorId.username || '',
          username: s.authorId.username || '',
        }
      : undefined,
    genres: Array.isArray(s.genreIds)
      ? s.genreIds.map((g) => ({ name: g.name, slug: g.slug }))
      : [],
  }))

  const publicData = {
    suggestions: suggestionsList,
    stories: formattedStories,
    trending: DEFAULT_TRENDING,
  }

  // Cache in Redis for 300 seconds (5 minutes)
  if (!cachedData && redis.status === 'ready') {
    try {
      await redis.set(cacheKey, JSON.stringify(publicData), 'EX', 300)
    } catch (err) {
      logger.warn('Redis write error for search suggestions:', err)
    }
  }

  return {
    history,
    ...publicData,
  }
}

export const getUserSearchHistory = async (userId: string) => {
  const docs = await searchHistoryRepository.findByUserId(userId, 15)
  return docs.map((doc) => ({
    _id: doc._id.toString(),
    query: doc.query,
    updatedAt: doc.updatedAt,
  }))
}

export const deleteUserSearchHistory = async (
  userId: string,
  query?: string
) => {
  if (query && query.trim()) {
    await searchHistoryRepository.deleteItem(userId, query.trim())
    return { success: true, message: `Đã xóa từ khóa "${query.trim()}" khỏi lịch sử` }
  } else {
    const deletedCount = await searchHistoryRepository.clearAll(userId)
    return { success: true, message: `Đã xóa toàn bộ ${deletedCount} mục lịch sử tìm kiếm` }
  }
}

export const searchService = {
  searchStories,
  getSuggestions,
  getUserSearchHistory,
  deleteUserSearchHistory,
}
