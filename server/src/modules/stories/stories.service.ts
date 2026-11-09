import { Types } from 'mongoose'
import { storyRepository, StoryFilterOptions } from '../../repositories/story.repository.js'
import { genreRepository } from '../../repositories/genre.repository.js'
import { tagRepository } from '../../repositories/tag.repository.js'
import { CreateStoryInput, UpdateStoryInput } from './stories.validation.js'
import { IStory, StoryStatus } from '../../models/Story.model.js'
import { AppError } from '../../common/AppError.js'
import { slugify } from '../../common/slugify.js'
import { logger } from '../../common/logger.js'
import { crawlerStorySourceRepository } from '../../repositories/crawler-story-source.repository.js'
import { resolveSource } from '../chapters/crawler.config.js'
import { decodeCover } from '../seo/seo.cover.js'
import { recordReadView } from '../../common/readView.js'

const generateUniqueSlug = async (title: string, currentStoryId?: string): Promise<string> => {
  const baseSlug = slugify(title) || 'truyen'
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await storyRepository.findBySlug(slug)
    if (!existing || (currentStoryId && existing._id.toString() === currentStoryId)) {
      return slug
    }
    slug = `${baseSlug}-${counter}`
    counter++
  }
}

export const getStories = async (queryParams: {
  cursor?: string | null
  limit: number
  genre?: string
  tag?: string
  status?: StoryStatus
  sort?: 'new' | 'hot' | 'top-week' | 'top-month' | 'top-year' | 'rating' | 'chapters'
  q?: string
  author?: string
}) => {
  let genreId: string | undefined
  if (queryParams.genre) {
    if (Types.ObjectId.isValid(queryParams.genre)) {
      genreId = queryParams.genre
    } else {
      const g = await genreRepository.findBySlug(queryParams.genre)
      if (g) genreId = g._id.toString()
    }
  }

  let tagId: string | undefined
  if (queryParams.tag) {
    if (Types.ObjectId.isValid(queryParams.tag)) {
      tagId = queryParams.tag
    } else {
      const t = await tagRepository.findBySlug(queryParams.tag)
      if (t) tagId = t._id.toString()
    }
  }

  let authorId: string | undefined
  if (queryParams.author && queryParams.author !== 'undefined') {
    authorId = queryParams.author
  }

  const options: StoryFilterOptions = {
    catalogProjection: true,
    cursor: queryParams.cursor,
    limit: queryParams.limit,
    genreId,
    tagId,
    authorId,
    status: queryParams.status,
    sort: queryParams.sort,
    q: queryParams.q,
    moderationStatus: 'approved',
  }

  return storyRepository.findStories(options)
}

export const getAuthorStories = async (
  authorId: string,
  queryParams: {
    cursor?: string | null
    limit: number
    status?: StoryStatus
    sort?: 'new' | 'hot' | 'top-week' | 'top-month' | 'top-year' | 'rating' | 'chapters'
  }
) => {
  const options: StoryFilterOptions = {
    cursor: queryParams.cursor,
    limit: queryParams.limit,
    authorId,
    status: queryParams.status,
    sort: queryParams.sort || 'new',
    moderationStatus: undefined, // Author sees all statuses (approved, pending, hidden)
  }

  return storyRepository.findStories(options)
}

export const getStoryBySlug = async (slug: string, visitor?: string) => {
  const story = await storyRepository.findBySlug(slug)
  if (!story || story.moderationStatus !== 'approved') {
    throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ', 'STORY_NOT_FOUND')
  }

  if (await recordReadView(`story:${story._id}`, visitor, () => storyRepository.incrementViewCount(story._id))) story.viewCount += 1

  return story
}

export const getStoryById = async (id: string) => {
  const story = await storyRepository.findById(id)
  if (!story || story.moderationStatus === 'removed') {
    throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ', 'STORY_NOT_FOUND')
  }
  return story
}

export const createStory = async (authorId: string, input: CreateStoryInput) => {
  let crawlerSourceUrl: string | undefined
  if (input.crawlerSourceUrl) {
    crawlerSourceUrl = resolveSource(input.crawlerSourceUrl).url.href
    await crawlerStorySourceRepository.initialize()
    if (await crawlerStorySourceRepository.find(crawlerSourceUrl)) {
      throw AppError.conflict('Truyện từ URL nguồn này đã có trên hệ thống. Hãy dùng chức năng nhập chương còn thiếu.', 'CRAWLER_STORY_EXISTS')
    }
  }
  // Validate genres
  const genreIds = await genreRepository.findByIds(input.genreIds)
  if (genreIds.length === 0) {
    throw AppError.badRequest('Thể loại được chọn không hợp lệ', 'INVALID_GENRES')
  }

  // Handle tags (ids + string names)
  let allTagIds: Types.ObjectId[] = (input.tagIds || []).map((id) => new Types.ObjectId(id))
  if (input.tags && input.tags.length > 0) {
    const createdTags = await tagRepository.findByNamesOrCreate(input.tags)
    const newIds = createdTags.map((t) => t._id)
    allTagIds = [...new Set([...allTagIds.map((id) => id.toString()), ...newIds.map((id) => id.toString())])].map(
      (id) => new Types.ObjectId(id)
    )
  }

  const slug = await generateUniqueSlug(input.title)

  const data = {
    title: input.title,
    slug,
    description: input.description,
    originalAuthor: input.originalAuthor,
    sourceName: input.sourceName || (input.originalAuthor ? 'Sưu tầm' : undefined),
    coverUrl: input.coverBase64,
    authorId: new Types.ObjectId(authorId),
    genreIds: genreIds.map((g) => g._id),
    tagIds: allTagIds,
    status: input.status || 'ongoing',
    moderationStatus: 'pending' as const,
    contentWarning: input.contentWarning || 'none',
  }
  const story = crawlerSourceUrl
    ? await crawlerStorySourceRepository.createStory(data, crawlerSourceUrl)
    : await storyRepository.create(data)

  logger.info(`Story created: "${story.title}" (${story._id}) by author ${authorId}`)

  return storyRepository.findById(story._id.toString())
}

export const updateStory = async (id: string, input: UpdateStoryInput) => {
  const existingStory = await storyRepository.findById(id)
  if (!existingStory || existingStory.moderationStatus === 'removed') {
    throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ', 'STORY_NOT_FOUND')
  }

  const updateData: Partial<IStory> = {}
  if (input.originalAuthor !== undefined) updateData.originalAuthor = input.originalAuthor
  if (input.sourceName !== undefined) updateData.sourceName = input.sourceName

  if (input.title && input.title !== existingStory.title) {
    updateData.title = input.title
    updateData.slug = await generateUniqueSlug(input.title, id)
  }

  if (input.description) {
    updateData.description = input.description
  }

  if (input.coverBase64 !== undefined) {
    updateData.coverUrl = input.coverBase64 || ''
  }

  if (input.status) {
    updateData.status = input.status
  }

  if (input.contentWarning) {
    updateData.contentWarning = input.contentWarning
  }

  if (input.genreIds && input.genreIds.length > 0) {
    const genres = await genreRepository.findByIds(input.genreIds)
    if (genres.length > 0) {
      updateData.genreIds = genres.map((g) => g._id)
    }
  }

  if (input.tagIds || input.tags) {
    let allTagIds: string[] = (input.tagIds || []).map((tId) => tId.toString())
    if (input.tags && input.tags.length > 0) {
      const createdTags = await tagRepository.findByNamesOrCreate(input.tags)
      allTagIds = [...allTagIds, ...createdTags.map((t) => t._id.toString())]
    }
    updateData.tagIds = [...new Set(allTagIds)].map((tId) => new Types.ObjectId(tId))
  }

  if (Object.keys(updateData).length > 0 && existingStory.moderationStatus !== 'hidden') {
    updateData.moderationStatus = 'pending'
  }
  const updated = await storyRepository.updateById(id, updateData)
  logger.info(`Story updated: "${updated?.title}" (${id})`)
  return updated
}

export const deleteStory = async (id: string) => {
  const story = await storyRepository.findById(id)
  if (!story || story.moderationStatus === 'removed') {
    throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ', 'STORY_NOT_FOUND')
  }

  await storyRepository.softDeleteById(id)
  logger.info(`Story soft-deleted: "${story.title}" (${id})`)
}

export const getStoryStats = async (id: string) => {
  const story = await storyRepository.findById(id)
  if (!story || story.moderationStatus === 'removed') {
    throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ', 'STORY_NOT_FOUND')
  }

  return {
    id: story._id.toString(),
    title: story.title,
    viewCount: story.viewCount,
    followCount: story.followCount,
    ratingAverage: story.ratingAverage,
    ratingCount: story.ratingCount,
    chapterCount: story.chapterCount,
  }
}

export const getRanking = async (queryParams: {
  metric?: 'views' | 'follows' | 'rating' | 'chapters'
  period?: 'all' | 'month' | 'week'
  genre?: string
  cursor?: string | null
  limit: number
}) => {
  if (queryParams.period && queryParams.period !== 'all') {
    throw AppError.badRequest('Chưa có thống kê theo kỳ. Vui lòng chọn toàn thời gian.', 'RANKING_PERIOD_UNAVAILABLE')
  }
  let genreId: string | undefined
  if (queryParams.genre) {
    if (Types.ObjectId.isValid(queryParams.genre)) {
      genreId = queryParams.genre
    } else {
      const g = await genreRepository.findBySlug(queryParams.genre)
      if (g) genreId = g._id.toString()
    }
  }

  return storyRepository.getRanking({
    catalogProjection: true,
    metric: queryParams.metric,
    period: queryParams.period,
    genreId,
    cursor: queryParams.cursor,
    limit: queryParams.limit,
  })
}

export const storiesService = {
  async getPublicCover(id: string) {
    const story = await storyRepository.findPublicCover(id)
    const cover = decodeCover(story?.coverUrl ?? null)
    if (!cover) throw AppError.notFound('Ảnh bìa không khả dụng', 'COVER_NOT_FOUND')
    return cover
  },
  getStories,
  getAuthorStories,
  getStoryBySlug,
  getStoryById,
  createStory,
  updateStory,
  deleteStory,
  getStoryStats,
  getRanking,
}
