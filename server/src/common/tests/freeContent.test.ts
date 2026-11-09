import { describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'
import { Story } from '../../models/Story.model.js'
import { Chapter } from '../../models/Chapter.model.js'
import { User } from '../../models/User.model.js'
import { storyRepository } from '../../repositories/story.repository.js'
import { createChapterSchema } from '../../modules/chapters/chapters.validation.js'

describe('Free reading compatibility with older stored documents', () => {
  it('returns full chapter content without retired access/pricing fields', () => {
    const chapter = Chapter.hydrate({
      _id: new Types.ObjectId(), storyId: new Types.ObjectId(), title: 'Chương cũ', slug: 'chapter', order: 1,
      contentHtml: '<p>Toàn bộ nội dung chương cũ.</p>', status: 'published', moderationStatus: 'approved',
      isVip: true, priceInCoins: 20,
    })
    expect(chapter.get('isVip')).toBe(true)
    for (const output of [chapter.toJSON(), chapter.toObject()]) {
      expect(output.contentHtml).toBe('<p>Toàn bộ nội dung chương cũ.</p>')
      expect(output.moderationStatus).toBe('approved')
      expect(output).not.toHaveProperty('isVip')
      expect(output).not.toHaveProperty('priceInCoins')
    }
  })

  it('omits retired user and story fields while preserving identity and moderation', () => {
    const user = User.hydrate({ _id: new Types.ObjectId(), username: 'reader', role: 'author', password: 'hash',
      isVip: true, vipExpireAt: new Date(), mainCoins: 100, bonusCoins: 20 })
    const story = Story.hydrate({ _id: new Types.ObjectId(), title: 'Truyện cũ', moderationStatus: 'hidden', isVip: true, vipPrice: 100 })
    expect(user.toJSON()).toMatchObject({ username: 'reader', role: 'author' })
    expect(user.toJSON()).not.toHaveProperty('password')
    for (const output of [user.toJSON(), user.toObject(), story.toJSON(), story.toObject()]) {
      for (const field of ['isVip', 'vipExpireAt', 'vipPrice', 'mainCoins', 'bonusCoins']) expect(output).not.toHaveProperty(field)
    }
    expect(story.toJSON().moderationStatus).toBe('hidden')
  })

  it('omits pricing fields in search aggregation results, which bypass document serialization', async () => {
    const oldStory = { _id: new Types.ObjectId(), title: 'Truyện cũ', viewCount: 1, isVip: true, vipPrice: 100 }
    const aggregate = vi.spyOn(Story, 'aggregate').mockReturnValue({ option: async () => [oldStory] } as never)
    const populate = vi.spyOn(Story, 'populate').mockImplementation(async docs => docs as never)
    try {
      const result = await storyRepository.searchStories({ limit: 20 })
      expect(result.stories[0]).toMatchObject({ title: 'Truyện cũ', viewCount: 1 })
      expect(result.stories[0]).not.toHaveProperty('isVip')
      expect(result.stories[0]).not.toHaveProperty('vipPrice')
    } finally {
      aggregate.mockRestore()
      populate.mockRestore()
    }
  })

  it('ignores retired pricing inputs without weakening publication validation', () => {
    const input = { title: 'Chương miễn phí', contentHtml: '<p>Nội dung miễn phí.</p>', isVip: true, priceInCoins: 20 }
    const chapter = createChapterSchema.parse(input)
    expect(chapter.status).toBe('draft')
    expect(chapter).not.toHaveProperty('isVip')
    expect(chapter).not.toHaveProperty('priceInCoins')
    expect(createChapterSchema.safeParse({ ...input, status: 'invalid' }).success).toBe(false)
  })
})
