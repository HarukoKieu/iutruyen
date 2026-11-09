import { bookmarkRepository } from '../../repositories/bookmark.repository.js'
import { chapterRepository } from '../../repositories/chapter.repository.js'
import { CreateBookmarkDto } from './bookmarks.validation.js'
import { AppError } from '../../common/AppError.js'
import { isPublicChapter, isPublicStory } from '../../common/contentVisibility.js'
import { personalPage } from '../../common/personalPagination.js'

export const bookmarksService = {
  async getUserBookmarksPage(userId: string, limit: number, cursor?: string) {
    return personalPage(await bookmarkRepository.findByUserId(userId, limit + 1, cursor), limit, 'createdAt',
      row => (row.chapterId as unknown as { storyId?: unknown } | null)?.storyId)
  },
  async createBookmark(userId: string, input: CreateBookmarkDto) {
    const chapter = await chapterRepository.findById(input.chapterId)
    if (!chapter || !isPublicChapter(chapter) || !isPublicStory(chapter.storyId as unknown as { moderationStatus: string })) {
      throw AppError.notFound('Chương không tồn tại', 'CHAPTER_NOT_FOUND')
    }
    return bookmarkRepository.create(userId, input.chapterId, input.note)
  },

  async getUserBookmarks(userId: string, limit: number = 50) {
    const items = await bookmarkRepository.findByUserId(userId, limit)
    return items.filter(item => (item.chapterId as unknown as { storyId?: unknown } | null)?.storyId)
  },

  async deleteBookmark(userId: string, bookmarkId: string) {
    const bookmark = await bookmarkRepository.deleteById(bookmarkId, userId)
    if (!bookmark) {
      throw AppError.notFound('Bookmark không tồn tại', 'BOOKMARK_NOT_FOUND')
    }
  },

  async deleteBookmarkByChapter(userId: string, chapterId: string) {
    await bookmarkRepository.deleteByChapter(userId, chapterId)
  },

  async checkBookmark(userId: string, chapterId: string) {
    return bookmarkRepository.findOne(userId, chapterId)
  },
}
