/**
 * SEO Repository Tests — Phase 8
 * Unit tests với mock Mongoose models.
 * Kiểm tra: visibility filter, DTO mapping, cursor pagination, SSRF protection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

// Mock Mongoose models TRƯỚC khi import repository
vi.mock('../../../models/Story.model.js', () => ({
  Story: {
    findOne: vi.fn(),
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock('../../../models/Chapter.model.js', () => ({
  Chapter: {
    findOne: vi.fn(),
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock('../../../common/pagination.js', () => ({
  encodeCursor: vi.fn((obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')),
  decodeCursor: vi.fn((str) => {
    try {
      return JSON.parse(Buffer.from(str, 'base64url').toString())
    } catch {
      return null
    }
  }),
}))

import { seoRepository } from '../../../repositories/seo.repository.js'
import { Story } from '../../../models/Story.model.js'
import { Chapter } from '../../../models/Chapter.model.js'

const mockStory = vi.mocked(Story)
const mockChapter = vi.mocked(Chapter)

// Helper tạo chainable query mock
const makeQueryChain = (returnValue: unknown) => {
  const chain: Record<string, unknown> = {}
  const methods = ['maxTimeMS', 'select', 'populate', 'lean', 'sort', 'limit', 'where']
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain)
  })
  ;(chain as { then: (resolve: (v: unknown) => void) => void }).then = (resolve: (v: unknown) => void) =>
    Promise.resolve(returnValue).then(resolve)
  return chain
}

// Helper tạo chainable aggregate mock
const makeAggregateChain = (returnValue: unknown[]) => ({
  option: vi.fn(() => Promise.resolve(returnValue)),
})

describe('seoRepository.findPublicStoryBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries with slug and moderationStatus=approved', async () => {
    const storyDoc = {
      _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
      slug: 'truyen-test',
      title: 'Truyện Test',
      description: 'Mô tả',
      coverUrl: undefined,
      contentWarning: 'none',
      status: 'ongoing',
      moderationStatus: 'approved',
      chapterCount: 5,
      viewCount: 100,
      followCount: 10,
      ratingAverage: 4.0,
      ratingCount: 20,
      originalAuthor: 'Tác giả gốc',
      sourceName: 'nguon.com',
      authorId: { username: 'user1', displayName: 'User 1' },
      genreIds: [{ _id: new Types.ObjectId('507f1f77bcf86cd799439013'), name: 'Tiên Hiệp', slug: 'tien-hiep' }],
      tagIds: [],
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-09-01'),
    }

    const chain = makeQueryChain(storyDoc)
    mockStory.findOne.mockReturnValue(chain as never)

    const result = await seoRepository.findPublicStoryBySlug('truyen-test')

    expect(mockStory.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'truyen-test',
        moderationStatus: 'approved',
      })
    )
    expect(result).not.toBeNull()
    expect(result?.slug).toBe('truyen-test')
    expect(result?.genres[0]._id).toBe('507f1f77bcf86cd799439013')
  })

  it('returns null when story not found', async () => {
    const chain = makeQueryChain(null)
    mockStory.findOne.mockReturnValue(chain as never)

    const result = await seoRepository.findPublicStoryBySlug('khong-ton-tai')
    expect(result).toBeNull()
  })

  it('does NOT expose email or role in DTO', async () => {
    const storyDoc = {
      _id: new Types.ObjectId(),
      slug: 'truyen-test',
      title: 'T',
      description: 'D',
      contentWarning: 'none',
      status: 'ongoing',
      moderationStatus: 'approved',
      chapterCount: 0,
      viewCount: 0,
      followCount: 0,
      ratingAverage: 0,
      ratingCount: 0,
      authorId: {
        username: 'user1',
        displayName: 'User 1',
        email: 'secret@example.com', // KHÔNG được expose
        role: 'admin', // KHÔNG được expose
      },
      genreIds: [],
      tagIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const chain = makeQueryChain(storyDoc)
    mockStory.findOne.mockReturnValue(chain as never)

    const result = await seoRepository.findPublicStoryBySlug('truyen-test')

    if (result?.author) {
      expect('email' in result.author).toBe(false)
      expect('role' in result.author).toBe(false)
    }
  })
})

describe('seoRepository.findPublicToc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty result for invalid storyId', async () => {
    const result = await seoRepository.findPublicToc('invalid-id')
    expect(result.items).toHaveLength(0)
    expect(mockChapter.find).not.toHaveBeenCalled()
  })

  it('queries chapters with public filter (published+approved)', async () => {
    const mockChapters = [
      { _id: new Types.ObjectId(), slug: 'chuong-1', title: 'Chương 1', order: 1, status: 'published', moderationStatus: 'approved', publishAt: null, storyId: new Types.ObjectId(), viewCount: 2, createdAt: new Date('2026-01-01T00:00:00.000Z') },
    ]

    const sortChain = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maxTimeMS: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockChapters),
    }
    mockChapter.find.mockReturnValue(sortChain as never)

    const storyId = new Types.ObjectId().toString()
    const result = await seoRepository.findPublicToc(storyId)

    expect(mockChapter.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
        moderationStatus: 'approved',
      })
    )
    expect(result.items).toHaveLength(1)
    expect(result.items[0].slug).toBe('chuong-1')
    expect(result.items[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(result.items[0].viewCount).toBe(2)
    expect(sortChain.select).toHaveBeenCalledWith(expect.stringContaining('createdAt'))
  })

  it('signals hasMore correctly', async () => {
    // limit=2 → fetch 3 items → hasMore=true
    const mockChapters = [
      { _id: new Types.ObjectId(), slug: 'c1', title: 'C1', order: 1, status: 'published', moderationStatus: 'approved', publishAt: null, storyId: new Types.ObjectId(), viewCount: 2, createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { _id: new Types.ObjectId(), slug: 'c2', title: 'C2', order: 2, status: 'published', moderationStatus: 'approved', publishAt: null, storyId: new Types.ObjectId(), viewCount: 2, createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { _id: new Types.ObjectId(), slug: 'c3', title: 'C3', order: 3, status: 'published', moderationStatus: 'approved', publishAt: null, storyId: new Types.ObjectId(), viewCount: 2, createdAt: new Date('2026-01-01T00:00:00.000Z') },
    ]

    const sortChain = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maxTimeMS: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockChapters),
    }
    mockChapter.find.mockReturnValue(sortChain as never)

    const storyId = new Types.ObjectId().toString()
    const result = await seoRepository.findPublicToc(storyId, undefined, 2)

    expect(result.hasMore).toBe(true)
    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).not.toBeNull()
  })
})

describe('seoRepository.findCoverForPublicStory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for invalid ObjectId', async () => {
    const result = await seoRepository.findCoverForPublicStory('not-an-objectid')
    expect(result).toBeNull()
    expect(mockStory.findOne).not.toHaveBeenCalled()
  })

  it('queries with approved + none contentWarning (no mature)', async () => {
    const chain = makeQueryChain({ coverUrl: 'data:image/jpeg;base64,abc' })
    mockStory.findOne.mockReturnValue(chain as never)

    const id = new Types.ObjectId().toString()
    await seoRepository.findCoverForPublicStory(id)

    expect(mockStory.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        moderationStatus: 'approved',
        contentWarning: 'none', // mature bị loại
      })
    )
  })

  it('returns null when story not found or is mature', async () => {
    const chain = makeQueryChain(null)
    mockStory.findOne.mockReturnValue(chain as never)

    const id = new Types.ObjectId().toString()
    const result = await seoRepository.findCoverForPublicStory(id)
    expect(result).toBeNull()
  })
})

describe('seoRepository.scanStoryIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ids and lastId', async () => {
    const objId1 = new Types.ObjectId()
    const objId2 = new Types.ObjectId()
    const docs = [{ _id: objId1 }, { _id: objId2 }]

    const chain = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maxTimeMS: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(docs),
    }
    mockStory.find.mockReturnValue(chain as never)

    const result = await seoRepository.scanStoryIds(undefined, 1000)
    expect(result.ids).toHaveLength(2)
    expect(result.lastId).toBe(String(objId2))
  })

  it('returns empty when no docs', async () => {
    const chain = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maxTimeMS: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    }
    mockStory.find.mockReturnValue(chain as never)

    const result = await seoRepository.scanStoryIds()
    expect(result.ids).toHaveLength(0)
    expect(result.lastId).toBeNull()
  })
})

describe('seoRepository.hydrateStoryIdsForSitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters only approved + non-mature stories', async () => {
    const validId = new Types.ObjectId()
    const docs = [{ _id: validId, slug: 'truyen-ok' }]

    const chain = {
      select: vi.fn().mockReturnThis(),
      maxTimeMS: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(docs),
    }
    mockStory.find.mockReturnValue(chain as never)

    const ids = [validId.toString(), new Types.ObjectId().toString()]
    const result = await seoRepository.hydrateStoryIdsForSitemap(ids)

    // Phải query với approved + none contentWarning
    expect(mockStory.find).toHaveBeenCalledWith(
      expect.objectContaining({
        moderationStatus: 'approved',
        contentWarning: 'none',
      })
    )
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('truyen-ok')
  })

  it('returns empty for empty ids array', async () => {
    const result = await seoRepository.hydrateStoryIdsForSitemap([])
    expect(result).toHaveLength(0)
    expect(mockStory.find).not.toHaveBeenCalled()
  })

  it('filters invalid ObjectIds before querying', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      maxTimeMS: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    }
    mockStory.find.mockReturnValue(chain as never)

    // Chỉ id1 là valid ObjectId
    const ids = ['invalid-id', 'also-invalid', new Types.ObjectId().toString()]
    await seoRepository.hydrateStoryIdsForSitemap(ids)

    // Phải vẫn query (1 valid id)
    expect(mockStory.find).toHaveBeenCalled()
  })
})
