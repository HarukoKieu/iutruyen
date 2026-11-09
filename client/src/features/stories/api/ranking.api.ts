import { api } from '@/lib/axios'
import { catalogCover } from './catalogCover'
import type { Story } from '@/types/story'
import type { RankingQueryParams, RankingResponse, RankingPaginationMeta } from '@/types/ranking'

export const fetchRanking = async (
  params: RankingQueryParams
): Promise<{ stories: Story[]; meta: RankingPaginationMeta }> => {
  const { data } = await api.get<RankingResponse>('/stories/ranking', { params })
  return { stories: data.data.map(catalogCover), meta: data.meta }
}

export const rankingApi = {
  fetchRanking,
}
