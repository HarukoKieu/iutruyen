import { Tag, ITag } from '../models/Tag.model.js'
import { slugify } from '../common/slugify.js'

export const findAll = async (): Promise<ITag[]> => {
  return Tag.find().sort({ name: 1 })
}

export const findByIds = async (ids: string[]): Promise<ITag[]> => {
  return Tag.find({ _id: { $in: ids } })
}

export const findBySlug = async (slug: string): Promise<ITag | null> => {
  return Tag.findOne({ slug })
}

export const findOrCreateByName = async (name: string): Promise<ITag> => {
  const cleanName = name.trim()
  const slug = slugify(cleanName)

  let tag = await Tag.findOne({ slug })
  if (!tag) {
    tag = await Tag.create({ name: cleanName, slug })
  }
  return tag
}

export const findByNamesOrCreate = async (names: string[]): Promise<ITag[]> => {
  const tags: ITag[] = []
  for (const name of names) {
    if (name && name.trim()) {
      const tag = await findOrCreateByName(name)
      tags.push(tag)
    }
  }
  return tags
}

export const searchTags = async (q: string): Promise<ITag[]> => {
  const literal = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return Tag.find({
    name: { $regex: literal, $options: 'i' },
  }).limit(20).maxTimeMS(2000)
}

export const tagRepository = {
  findAll,
  findByIds,
  findBySlug,
  findOrCreateByName,
  findByNamesOrCreate,
  searchTags,
}
