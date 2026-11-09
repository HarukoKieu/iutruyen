import { Types } from 'mongoose'
import { chapterRepository } from '../../repositories/chapter.repository.js'
import { storyRepository } from '../../repositories/story.repository.js'
import { readingHistoryRepository } from '../../repositories/reading-history.repository.js'
import { CreateChapterDto, UpdateChapterDto, ChapterListQuery } from './chapters.validation.js'
import { AppError } from '../../common/AppError.js'
import { slugify } from '../../common/slugify.js'
import { logger } from '../../common/logger.js'
import { notificationsService } from '../notifications/notifications.service.js'
import { sanitizeHtml, countWordsFromHtml } from '../../common/sanitizeHtml.js'
import { isPublicStory, isPublicChapter, canPreviewStory, resourceId } from '../../common/contentVisibility.js'
import { recordReadView } from '../../common/readView.js'

interface IUserPayload {
  id: string
  role: string
  authorStatus?: string
}

const extractAuthorId = (author: unknown): string => {
  if (!author) return ''
  if (author instanceof Types.ObjectId) return author.toString()
  if (typeof author === 'object' && '_id' in (author as object)) {
    return String((author as { _id: unknown })._id)
  }
  return String(author)
}

const generateChapterSlug = async (
  storyId: string | Types.ObjectId,
  title: string,
  order: number,
  currentChapterId?: string
): Promise<string> => {
  // Unsafe numbers can stringify as exponent notation, which is not a valid URL slug.
  if (!Number.isSafeInteger(order) || order < 1) throw AppError.badRequest('Thứ tự chương không hợp lệ', 'INVALID_CHAPTER_ORDER')
  const titleSlug = slugify(title)
  const baseSlug = titleSlug ? `chuong-${order}-${titleSlug}` : `chuong-${order}`
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await chapterRepository.findByStoryAndSlug(storyId, slug)
    if (!existing || (currentChapterId && existing._id.toString() === currentChapterId)) {
      return slug
    }
    slug = `${baseSlug}-${counter}`
    counter++
  }
}

export const chaptersService = {
  async getChaptersByStory(storyIdOrSlug: string, user?: IUserPayload, query: ChapterListQuery = { limit: 50, sort: 'asc' }) {
    let story = await storyRepository.findBySlug(storyIdOrSlug)
    if (!story) {
      if (Types.ObjectId.isValid(storyIdOrSlug)) {
        story = await storyRepository.findById(storyIdOrSlug)
      }
    }

    if (!story || story.moderationStatus === 'removed') {
      throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ', 'STORY_NOT_FOUND')
    }

    const authorId = extractAuthorId(story.authorId)
    const isAuthor = user && user.id === authorId
    const isPrivileged = user && ['admin', 'moderator'].includes(user.role)

    if (!isPublicStory(story) && !canPreviewStory(story, user)) {
      throw AppError.notFound('Truyện không tồn tại', 'STORY_NOT_FOUND')
    }

    return chapterRepository.findChapterPage(story._id, !!(isAuthor || isPrivileged), query)
  },

  async getChapterBySlug(storyIdOrSlug: string, chapterSlug: string, user?: IUserPayload, visitor?: string) {
    let story = await storyRepository.findBySlug(storyIdOrSlug)
    if (!story) {
      if (Types.ObjectId.isValid(storyIdOrSlug)) {
        story = await storyRepository.findById(storyIdOrSlug)
      }
    }

    if (!story || story.moderationStatus === 'removed') {
      throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ', 'STORY_NOT_FOUND')
    }

    const chapter = await chapterRepository.findByStoryAndSlug(story._id, chapterSlug)
    if (!chapter) {
      throw AppError.notFound('Chương không tồn tại', 'CHAPTER_NOT_FOUND')
    }

    const authorId = extractAuthorId(story.authorId)
    const isAuthor = user && user.id === authorId
    const isPrivileged = user && ['admin', 'moderator'].includes(user.role)

    if ((!isPublicStory(story) || !isPublicChapter(chapter)) && !isAuthor && !isPrivileged) {
      throw AppError.notFound('Chương chưa được phát hành', 'CHAPTER_NOT_PUBLISHED')
    }

    // Previewing non-public content must not generate public analytics/history.
    if (isPublicStory(story) && isPublicChapter(chapter)) {
    await Promise.all([
      recordReadView(`chapter:${chapter._id}`, visitor, () => chapterRepository.incrementViewCount(chapter._id)),
      recordReadView(`story:${story._id}`, visitor, () => storyRepository.incrementViewCount(story._id)),
    ])

    // Async update reading history if user is authenticated
    if (user && user.id) {
      readingHistoryRepository
        .upsert(user.id, story._id, chapter._id)
        .catch((err: Error) => logger.error('Failed to update reading history:', err))
    }

    }
    const prevChapter = await chapterRepository.findPrevChapter(story._id, chapter.order)
    const nextChapter = await chapterRepository.findNextChapter(story._id, chapter.order)

    return {
      chapter: { ...(typeof chapter.toObject === 'function' ? chapter.toObject() : chapter), contentHtml: sanitizeHtml(chapter.contentHtml) },
      story: {
        _id: story._id,
        title: story.title,
        slug: story.slug,
        authorId: story.authorId,
        chapterCount: story.chapterCount,
        genreIds: story.genreIds,
        contentWarning: story.contentWarning ?? 'none',
        moderationStatus: story.moderationStatus,
      },
      prevChapter,
      nextChapter,
    }
  },

  async getChapterById(chapterId: string) {
    const chapter = await chapterRepository.findById(chapterId)
    if (!chapter) {
      throw AppError.notFound('Chương không tồn tại', 'CHAPTER_NOT_FOUND')
    }
    return chapter
  },

  async createChapter(storyId: string, input: CreateChapterDto) {
    if (input.status === 'scheduled' && !input.publishAt) throw AppError.badRequest('Chương hẹn giờ phải có ngày xuất bản', 'PUBLISH_AT_REQUIRED')
    const story = await storyRepository.findById(storyId)
    if (!story || story.moderationStatus === 'removed') {
      throw AppError.notFound('Truyện không tồn tại hoặc đã bị gỡ', 'STORY_NOT_FOUND')
    }

    const order = input.order || (await chapterRepository.getNextOrder(story._id))
    const slug = await generateChapterSlug(story._id, input.title, order)

    const sanitizedHtml = sanitizeHtml(input.contentHtml)
    const wordCount = countWordsFromHtml(sanitizedHtml)

    const chapter = await chapterRepository.create({
      storyId: story._id,
      title: input.title,
      slug,
      order,
      contentHtml: sanitizedHtml,
      wordCount,
      status: input.status || 'draft',
      moderationStatus: 'pending',
      publishAt: input.publishAt,
    })

    logger.info(
      `Chapter created: "${chapter.title}" (order ${chapter.order}) in story "${story.title}"`
    )

    // Trigger notification if published immediately
    if (isPublicStory(story) && isPublicChapter(chapter)) {
      notificationsService.notifyNewChapter(story, chapter).catch((err) => {
        logger.warn('Failed to send new chapter notification:', err)
      })
    }

    return chapter
  },

  async updateChapter(chapterId: string, input: UpdateChapterDto) {
    const existing = await chapterRepository.findById(chapterId)
    if (!existing) {
      throw AppError.notFound('Chương không tồn tại', 'CHAPTER_NOT_FOUND')
    }
    if ((input.status ?? existing.status) === 'scheduled' && !(input.publishAt ?? existing.publishAt)) {
      throw AppError.badRequest('Chương hẹn giờ phải có ngày xuất bản', 'PUBLISH_AT_REQUIRED')
    }

    const updateData: {
      title?: string
      contentHtml?: string
      wordCount?: number
      status?: 'draft' | 'scheduled' | 'published'
      publishAt?: Date
      order?: number
      slug?: string
      moderationStatus?: 'pending'
    } = {}
    if (input.title !== undefined) updateData.title = input.title
    if (input.contentHtml !== undefined) {
      updateData.contentHtml = sanitizeHtml(input.contentHtml)
      updateData.wordCount = countWordsFromHtml(updateData.contentHtml)
    }
    if (input.status !== undefined) updateData.status = input.status
    if (input.publishAt !== undefined) updateData.publishAt = input.publishAt
    if (input.order !== undefined) updateData.order = input.order
    if ((input.title !== undefined || input.contentHtml !== undefined) && existing.moderationStatus !== 'hidden') {
      updateData.moderationStatus = 'pending'
    }

    if (input.title && input.title !== existing.title && !/^crawl-[a-f0-9]{64}$/.test(existing.slug)) {
      const order = input.order || existing.order
      updateData.slug = await generateChapterSlug(
        existing.storyId,
        input.title,
        order,
        chapterId
      )
    }

    const updated = await chapterRepository.updateById(chapterId, updateData)

    // Recalculate published count
    const storyId = existing.storyId instanceof Types.ObjectId
      ? existing.storyId
      : (existing.storyId as unknown as { _id: Types.ObjectId })?._id ?? existing.storyId

    // Trigger notification if newly transitioned to published
    if (!isPublicChapter(existing) && isPublicChapter(updated)) {
      const storyDoc = await storyRepository.findById(storyId.toString())
      if (storyDoc && isPublicStory(storyDoc) && updated) {
        notificationsService.notifyNewChapter(storyDoc, updated).catch((err) => {
          logger.warn('Failed to send new chapter notification on update:', err)
        })
      }
    }

    logger.info(`Chapter updated: "${updated?.title}" (${chapterId})`)
    return updated
  },

  async deleteChapter(chapterId: string) {
    const existing = await chapterRepository.findById(chapterId)
    if (!existing) {
      throw AppError.notFound('Chương không tồn tại', 'CHAPTER_NOT_FOUND')
    }

    const storyId = resourceId(existing.storyId)

    await chapterRepository.deleteById(chapterId)



    logger.info(`Chapter deleted: "${existing.title}" (${chapterId})`)
  },

  async getChapterPreview(chapterId: string) {
    const chapter = await chapterRepository.findById(chapterId)
    if (!chapter) {
      throw AppError.notFound('Chương không tồn tại', 'CHAPTER_NOT_FOUND')
    }
    return chapter
  },
}
