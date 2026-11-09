export interface ReviewUser {
  _id: string
  displayName: string
  username: string
  avatarUrl?: string
  role: string
  authorStatus?: string
}

export interface Review {
  _id: string
  storyId: string
  userId: ReviewUser
  content: string
  likeCount: number
  likedByMe: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface ReviewListResult {
  items: Review[]
  hasMore: boolean
  nextCursor: string | null
}

export interface RatingResult {
  score: number | null
}

export interface UpsertRatingResponse {
  rating: {
    storyId: string
    userId: string
    score: number
  }
  storyStats: {
    ratingAverage: number
    ratingCount: number
  }
}
