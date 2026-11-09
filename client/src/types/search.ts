export interface SearchSuggestionStory {
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
}

export interface SearchSuggestionsResponse {
  history: string[]
  suggestions: string[]
  stories: SearchSuggestionStory[]
  trending: string[]
}

export interface SearchStoriesParams {
  q?: string
  genre?: string
  status?: 'ongoing' | 'completed' | 'hiatus'
  rating?: number
  sort?: 'relevance' | 'views' | 'rating' | 'newest' | 'chapters'
  cursor?: string | null
  limit?: number
}

export interface SearchHistoryItem {
  _id: string
  query: string
  updatedAt: string
}
