import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chaptersService } from '../chapters.service.js'
import { chapterRepository } from '../../../repositories/chapter.repository.js'
import { storyRepository } from '../../../repositories/story.repository.js'
import { AppError } from '../../../common/AppError.js'
import { Types } from 'mongoose'
import { notificationsService } from '../../notifications/notifications.service.js'
import { createChapterSchema, updateChapterSchema } from '../chapters.validation.js'

vi.mock('../../../repositories/chapter.repository.js', () => ({
  chapterRepository: {
    findById: vi.fn(),
    updateById: vi.fn(),
    countPublishedByStoryId: vi.fn(),
    findByStoryAndSlug: vi.fn(),
    findPublishedChaptersByStoryId: vi.fn(),
    findAllChaptersByStoryId: vi.fn(),
    findChapterPage: vi.fn(),
    findLatestChapter: vi.fn(),
    findByStoryAndOrder: vi.fn(),
    create: vi.fn(),
    getNextOrder: vi.fn(),
    update: vi.fn(),
    findPrevChapter: vi.fn(),
    findNextChapter: vi.fn(),
    incrementViewCount: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('../../../repositories/story.repository.js', () => ({
  storyRepository: {
    updateById: vi.fn(),
    findBySlug: vi.fn(),
    findById: vi.fn(),
    incrementViewCount: vi.fn().mockResolvedValue(true),
    incrementChapterCount: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('../../../repositories/reading-history.repository.js', () => ({
  readingHistoryRepository: {
    upsert: vi.fn().mockResolvedValue(true),
  },
}))
vi.mock('../../notifications/notifications.service.js', () => ({
  notificationsService: { notifyNewChapter: vi.fn().mockResolvedValue(0) },
}))

describe('Chapters Service', () => {
  const storyId = new Types.ObjectId()
  const fakeStory = {
    _id: storyId,
    title: 'Đại Phụng Đả Canh Nhân',
    slug: 'dai-phung-da-canh-nhan',
    authorId: 'author-111',
    moderationStatus: 'approved',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('mandatory chapter approval', () => {
    it.each(['draft', 'scheduled', 'published'] as const)('creates %s chapters pending review without notifying readers', async status => {
      vi.mocked(storyRepository.findById).mockResolvedValue(fakeStory as any)
      vi.mocked(chapterRepository.findByStoryAndSlug).mockResolvedValue(null)
      vi.mocked(chapterRepository.getNextOrder).mockResolvedValue(1)
      vi.mocked(chapterRepository.create).mockImplementation(async data => ({ ...data, _id: new Types.ObjectId() }) as any)
      vi.mocked(chapterRepository.countPublishedByStoryId).mockResolvedValue(0)

      const chapter = await chaptersService.createChapter(storyId.toString(), {
        title: 'Mở đầu', contentHtml: '<p>Nội dung chương mới</p>', status,
        publishAt: status === 'scheduled' ? new Date('2030-01-01') : undefined,
      })

      expect(chapter.moderationStatus).toBe('pending')
      expect(notificationsService.notifyNewChapter).not.toHaveBeenCalled()
      // Counter persistence belongs to the repository transaction, never a later service write.
      expect(storyRepository.updateById).not.toHaveBeenCalled()
    })

    it('does not accept author-supplied approval on create or update', () => {
      const body = { title: 'Mở đầu', contentHtml: '<p>Nội dung chương mới</p>', status: 'published', moderationStatus: 'approved' }
      expect(createChapterSchema.parse(body)).not.toHaveProperty('moderationStatus')
      expect(updateChapterSchema.parse(body)).not.toHaveProperty('moderationStatus')
    })

    it('cannot bypass pending approval by changing only publication status', async () => {
      const existing = { _id: new Types.ObjectId(), storyId, title: 'Mở đầu', order: 1, status: 'draft', moderationStatus: 'pending' }
      vi.mocked(chapterRepository.findById).mockResolvedValue(existing as any)
      vi.mocked(chapterRepository.updateById).mockResolvedValue({ ...existing, status: 'published' } as any)
      vi.mocked(chapterRepository.countPublishedByStoryId).mockResolvedValue(0)
      const updated = await chaptersService.updateChapter(existing._id.toString(), { status: 'published' })
      expect(updated?.moderationStatus).toBe('pending')
      expect(notificationsService.notifyNewChapter).not.toHaveBeenCalled()
    })
  })

  it('preserves crawler source identity when the author renames a chapter', async () => {
    const existing = { _id: new Types.ObjectId(), storyId, slug: `crawl-${'a'.repeat(64)}`, title: 'Tên cũ', order: 1, status: 'draft' }
    vi.mocked(chapterRepository.findById).mockResolvedValue(existing as any)
    vi.mocked(chapterRepository.updateById).mockResolvedValue({ ...existing, title: 'Tên mới' } as any)
    vi.mocked(chapterRepository.countPublishedByStoryId).mockResolvedValue(0)
    await chaptersService.updateChapter(existing._id.toString(), { title: 'Tên mới' })
    expect(chapterRepository.updateById).toHaveBeenCalledWith(existing._id.toString(), { title: 'Tên mới', moderationStatus: 'pending' })
    expect(chapterRepository.findByStoryAndSlug).not.toHaveBeenCalled()
  })

  describe('getChaptersByStory', () => {
    it('should return published chapters for guest/regular users', async () => {
      vi.mocked(storyRepository.findBySlug).mockResolvedValue(fakeStory as any)
      const fakeChapters = [{ _id: 'chap-1', title: 'Chương 1', order: 1, status: 'published' }]
      vi.mocked(chapterRepository.findChapterPage).mockResolvedValue({ items: fakeChapters, meta: { hasMore: false, nextCursor: null, limit: 50 } } as any)

      const res = await chaptersService.getChaptersByStory('dai-phung-da-canh-nhan')
      expect(res.items).toEqual(fakeChapters)
      expect(chapterRepository.findChapterPage).toHaveBeenCalledWith(storyId, false, { limit: 50, sort: 'asc' })
    })

    it('should return all chapters (including drafts) for the story author', async () => {
      vi.mocked(storyRepository.findBySlug).mockResolvedValue(fakeStory as any)
      const allChapters = [
        { _id: 'chap-1', title: 'Chương 1', status: 'published' },
        { _id: 'chap-2', title: 'Chương 2', status: 'draft' },
      ]
      vi.mocked(chapterRepository.findChapterPage).mockResolvedValue({ items: allChapters, meta: { hasMore: false, nextCursor: null, limit: 50 } } as any)

      const res = await chaptersService.getChaptersByStory('dai-phung-da-canh-nhan', {
        id: 'author-111',
        role: 'author',
      })
      expect(res.items).toEqual(allChapters)
      expect(chapterRepository.findChapterPage).toHaveBeenCalledWith(storyId, true, { limit: 50, sort: 'asc' })
    })
  })

  describe('getChapterBySlug', () => {
    it('should throw notFound if chapter is not found', async () => {
      vi.mocked(storyRepository.findBySlug).mockResolvedValue(fakeStory as any)
      vi.mocked(chapterRepository.findByStoryAndSlug).mockResolvedValue(null)

      await expect(
        chaptersService.getChapterBySlug('dai-phung-da-canh-nhan', 'chuong-99')
      ).rejects.toThrowError(AppError)
    })

    it('should return chapter with navigation for published chapter', async () => {
      vi.mocked(storyRepository.findBySlug).mockResolvedValue(fakeStory as any)
      const fakeChapter = {
        _id: 'chap-1',
        title: 'Chương 1',
        slug: 'chuong-1',
        order: 1,
        status: 'published',
        moderationStatus: 'approved',
        contentHtml: '<p>Nội dung</p>',
      }
      vi.mocked(chapterRepository.findByStoryAndSlug).mockResolvedValue(fakeChapter as any)
      vi.mocked(chapterRepository.findPrevChapter).mockResolvedValue(null)
      vi.mocked(chapterRepository.findNextChapter).mockResolvedValue({
        _id: 'chap-2',
        title: 'Chương 2',
        slug: 'chuong-2',
        order: 2,
      } as any)

      const res = await chaptersService.getChapterBySlug(
        'dai-phung-da-canh-nhan',
        'chuong-1'
      )

      expect(res.chapter).toEqual(fakeChapter)
      expect(res.story.moderationStatus).toBe('approved')
      expect(res.prevChapter).toBeNull()
      expect(res.nextChapter?.slug).toBe('chuong-2')
    })
  })
})
