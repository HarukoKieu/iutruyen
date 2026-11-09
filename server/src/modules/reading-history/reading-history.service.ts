import { storyRepository } from '../../repositories/story.repository.js'
import { readingHistoryRepository } from '../../repositories/reading-history.repository.js'
import { UpsertReadingHistoryDto } from './reading-history.validation.js'
import { chapterRepository } from '../../repositories/chapter.repository.js'
import { isPublicChapter, isPublicStory, resourceId } from '../../common/contentVisibility.js'
import { AppError } from '../../common/AppError.js'
import { personalPage } from '../../common/personalPagination.js'

export const readingHistoryService = {
  async getUserHistoryPage(userId: string, limit: number, cursor?: string) {
    return personalPage(await readingHistoryRepository.findByUserId(userId, limit + 1, cursor), limit, 'lastReadAt',
      row => row.storyId && row.lastChapterId)
  },
  async upsert(userId: string, input: UpsertReadingHistoryDto) {
    const chapter = await chapterRepository.findById(input.lastChapterId)
    if (!chapter || resourceId(chapter.storyId) !== input.storyId || !isPublicChapter(chapter) || !isPublicStory(chapter.storyId as unknown as { moderationStatus: string })) {
      throw AppError.notFound('Chương không tồn tại', 'CHAPTER_NOT_FOUND')
    }
    return readingHistoryRepository.upsert(
      userId,
      input.storyId,
      input.lastChapterId,
      input.scrollPositionPercent
    )
  },

  async getUserReadingHistory(userId: string, limit: number = 20) {
    const items = await readingHistoryRepository.findByUserId(userId, limit)
    return items.filter(item => item.storyId && item.lastChapterId)
  },

  async getStoryReadingProgress(userId: string, storyId: string) {
    if (!isPublicStory(await storyRepository.findById(storyId))) return null
    return readingHistoryRepository.findOne(userId, storyId)
  },
}
