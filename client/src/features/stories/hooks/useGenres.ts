import { useQuery } from '@tanstack/react-query'
import { genresApi } from '../api/genres.api'

export const useGenres = () => {
  return useQuery({
    queryKey: ['genres'],
    queryFn: genresApi.fetchGenres,
    staleTime: 1000 * 60 * 30, // 30 minutes cache
  })
}
