import { genreRepository } from '../../repositories/genre.repository.js'

export const getAllGenres = async () => {
  return genreRepository.findAll()
}

export const getGenreBySlug = async (slug: string) => {
  return genreRepository.findBySlug(slug)
}

export const genresService = {
  getAllGenres,
  getGenreBySlug,
}
