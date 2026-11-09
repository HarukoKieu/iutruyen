import { api } from '@/lib/axios'
import type { Genre } from '@/types/genre'

export const fetchGenres = async (): Promise<Genre[]> => {
  const { data } = await api.get('/genres')
  return data.data
}

export const genresApi = {
  fetchGenres,
}
