import type { Story, CursorPaginationMeta } from './story'

export type RankingMetric = 'views' | 'follows' | 'rating' | 'chapters'
export type RankingPeriod = 'all' | 'month' | 'week'

export interface RankingQueryParams {
  metric?: RankingMetric
  period?: RankingPeriod
  genre?: string
  cursor?: string
  limit?: number
}

export type { CursorPaginationMeta as RankingPaginationMeta }

export interface RankingResponse {
  success: boolean
  data: Story[]
  meta: CursorPaginationMeta
}
