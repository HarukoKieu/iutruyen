import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'
import { chaptersService } from '../chapters.service.js'
import { storyRepository } from '../../../repositories/story.repository.js'
import { chapterRepository } from '../../../repositories/chapter.repository.js'
vi.mock('../../../repositories/story.repository.js')
vi.mock('../../../repositories/chapter.repository.js')
vi.mock('../../../repositories/reading-history.repository.js')
vi.mock('../../notifications/notifications.service.js')
const id = new Types.ObjectId()
const owner = new Types.ObjectId().toString()
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(chapterRepository.incrementViewCount).mockResolvedValue(undefined)
  vi.mocked(storyRepository.incrementViewCount).mockResolvedValue(undefined)
  vi.mocked(chapterRepository.findPrevChapter).mockResolvedValue(null)
  vi.mocked(chapterRepository.findNextChapter).mockResolvedValue(null)
})
describe('public chapter eligibility', () => {
  for (const storyStatus of ['pending', 'approved', 'hidden', 'removed']) {
    for (const status of ['draft', 'scheduled', 'published']) {
      for (const moderationStatus of ['pending', 'approved', 'hidden']) {
        it(`${storyStatus}/${status}/${moderationStatus} is filtered for guests`, async () => {
          vi.mocked(storyRepository.findBySlug).mockResolvedValue({ _id: id, authorId: owner, moderationStatus: storyStatus, contentWarning: 'mature18+' } as never)
          vi.mocked(chapterRepository.findByStoryAndSlug).mockResolvedValue({ _id: id, status, moderationStatus, contentHtml: '<p onclick="bad()">Đọc</p>' } as never)
          const request = chaptersService.getChapterBySlug('story', 'chapter')
          if (storyStatus === 'approved' && status === 'published' && moderationStatus === 'approved') {
            const result = await request
            expect(result.story.contentWarning).toBe('mature18+')
            expect(result.chapter.contentHtml).toBe('<p>Đọc</p>')
          } else {
            await expect(request).rejects.toMatchObject({ statusCode: 404 })
            expect(chapterRepository.incrementViewCount).not.toHaveBeenCalled()
          }
        })
      }
    }
  }
  it.each(['author', 'moderator', 'admin'])('allows authenticated %s preview without public analytics', async role => {
    vi.mocked(storyRepository.findBySlug).mockResolvedValue({ _id: id, authorId: owner, moderationStatus: 'pending' } as never)
    vi.mocked(chapterRepository.findByStoryAndSlug).mockResolvedValue({ _id: id, status: 'draft', moderationStatus: 'pending', contentHtml: '<p>Preview</p>' } as never)
    await expect(chaptersService.getChapterBySlug('story', 'chapter', { id: role === 'author' ? owner : 'mod', role })).resolves.toHaveProperty('chapter')
    expect(chapterRepository.incrementViewCount).not.toHaveBeenCalled()
  })
  it.each(['author', 'moderator', 'admin'])('preserves hidden parent status in %s preview of an approved published chapter', async role => {
    vi.mocked(storyRepository.findBySlug).mockResolvedValue({ _id: id, authorId: owner, moderationStatus: 'hidden', contentWarning: 'none' } as never)
    vi.mocked(chapterRepository.findByStoryAndSlug).mockResolvedValue({ _id: id, status: 'published', moderationStatus: 'approved', contentHtml: '<p>Preview</p>' } as never)

    const result = await chaptersService.getChapterBySlug('story', 'chapter', { id: role === 'author' ? owner : 'mod', role })

    expect(result.story.moderationStatus).toBe('hidden')
    expect(result.chapter).toMatchObject({ status: 'published', moderationStatus: 'approved' })
    expect(chapterRepository.incrementViewCount).not.toHaveBeenCalled()
    expect(storyRepository.incrementViewCount).not.toHaveBeenCalled()
  })
})
