import { tagRepository } from '../../repositories/tag.repository.js'

export const getAllTags = async (q?: string) => {
  if (q && q.trim()) {
    return tagRepository.searchTags(q)
  }
  return tagRepository.findAll()
}

export const tagsService = {
  getAllTags,
}
