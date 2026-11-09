import { api } from '@/lib/axios'
import type { Tag } from '@/types/tag'

export const fetchTags = async (q?: string): Promise<Tag[]> => {
  const params = q ? { q } : {}
  const { data } = await api.get('/tags', { params })
  return data.data
}

export const tagsApi = {
  fetchTags,
}
