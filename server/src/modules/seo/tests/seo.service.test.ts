/**
 * SEO Service Tests — Phase 8
 * Unit tests cho seo.service.ts với mock repositories.
 * Kiểm tra: visibility policy, mature handling, DTO mapping, canonical URL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock env trước khi import service
vi.mock('../../../config/env.js', () => ({
  env: {
    PUBLIC_SITE_URL: 'https://iutruyen.vn',
    SEO_INDEXABLE: true,
    SEO_SITEMAP_INTERVAL_MS: 900_000,
    NODE_ENV: 'test',
  },
}))

vi.mock('../../../common/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../repositories/seo.repository.js', async (importOriginal) => ({
  mapStoryToDto: (await importOriginal<typeof import('../../../repositories/seo.repository.js')>()).mapStoryToDto,
  seoRepository: {
    findPublicStoryBySlug: vi.fn(),
    findPublicToc: vi.fn(),
    findPublicChapter: vi.fn(),
    findCoverForPublicStory: vi.fn(),
    scanStoryIds: vi.fn(),
    scanChapterIds: vi.fn(),
    hydrateStoryIdsForSitemap: vi.fn(),
    hydrateChapterIdsForSitemap: vi.fn(),
  },
}))

vi.mock('../../../repositories/story.repository.js', () => ({
  storyRepository: {
    findStories: vi.fn(),
    getRanking: vi.fn(),
  },
}))

import { seoService } from '../seo.service.js'
import { seoRepository } from '../../../repositories/seo.repository.js'
import { storyRepository } from '../../../repositories/story.repository.js'
import { AppError } from '../../../common/AppError.js'

const mockSeoRepo = vi.mocked(seoRepository)
const mockStoryRepo = vi.mocked(storyRepository)

// Fixture story DTO
const baseStoryDto = {
  _id: '507f1f77bcf86cd799439011',
  slug: 'truyen-test',
  title: 'Truyện Test',
  description: 'Mô tả truyện test rất hay',
  coverUrl: undefined,
  contentWarning: 'none' as const,
  status: 'ongoing',
  moderationStatus: 'approved' as const,
  chapterCount: 10,
  viewCount: 1000,
  followCount: 50,
  ratingAverage: 4.5,
  ratingCount: 100,
  originalAuthor: 'Tác giả gốc',
  sourceName: 'nguon.com',
  author: { username: 'author1', displayName: 'Tác Giả 1' },
  genres: [{ _id: '507f1f77bcf86cd799439013', name: 'Tiên Hiệp', slug: 'tien-hiep' }],
  tags: [{ _id: '507f1f77bcf86cd799439014', name: 'Trọng Sinh', slug: 'trong-sinh' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

const baseToc = {
  items: [{ _id: 'chap1', storyId: baseStoryDto._id, viewCount: 0, createdAt: baseStoryDto.createdAt, slug: 'chuong-1', title: 'Chương 1', order: 1, status: 'published', moderationStatus: 'approved' }],
  nextCursor: null,
  hasMore: false,
}

describe('seoService.getStoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns story page data for valid approved story', async () => {
    mockSeoRepo.findPublicStoryBySlug.mockResolvedValue(baseStoryDto)
    mockSeoRepo.findPublicToc.mockResolvedValue(baseToc)

    const result = await seoService.getStoryPage('truyen-test')

    expect(result.story.slug).toBe('truyen-test')
    expect(result.meta.canonical).toBe('https://iutruyen.vn/stories/truyen-test')
    expect(result.meta.indexable).toBe(true)
    expect(result.meta.og.type).toBe('book')
    expect(result.meta.jsonLd).not.toBeNull()
    expect(result.toc.items).toHaveLength(1)
  })

  it('throws 404 when story not found', async () => {
    mockSeoRepo.findPublicStoryBySlug.mockResolvedValue(null)

    await expect(seoService.getStoryPage('khong-ton-tai')).rejects.toThrow(AppError)
    await expect(seoService.getStoryPage('khong-ton-tai')).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('sets indexable=false and jsonLd=null for mature18+ story', async () => {
    mockSeoRepo.findPublicStoryBySlug.mockResolvedValue({
      ...baseStoryDto,
      contentWarning: 'mature18+',
    })
    mockSeoRepo.findPublicToc.mockResolvedValue(baseToc)

    const result = await seoService.getStoryPage('truyen-mature')

    expect(result.meta.indexable).toBe(false)
    expect(result.meta.jsonLd).toBeNull()
    expect(result.meta.contentWarning).toBe('mature18+')
  })

  it('builds correct JSON-LD Book with originalAuthor', async () => {
    mockSeoRepo.findPublicStoryBySlug.mockResolvedValue(baseStoryDto)
    mockSeoRepo.findPublicToc.mockResolvedValue(baseToc)

    const result = await seoService.getStoryPage('truyen-test')
    const jsonLd = result.meta.jsonLd as Record<string, unknown>

    expect(jsonLd['@type']).toBe('Book')
    expect((jsonLd['author'] as { name: string }).name).toBe('Tác giả gốc')
  })

  it('uses author displayName when no originalAuthor', async () => {
    mockSeoRepo.findPublicStoryBySlug.mockResolvedValue({
      ...baseStoryDto,
      originalAuthor: undefined,
      sourceName: undefined,
    })
    mockSeoRepo.findPublicToc.mockResolvedValue(baseToc)

    const result = await seoService.getStoryPage('truyen-test')
    const jsonLd = result.meta.jsonLd as Record<string, unknown>
    expect((jsonLd['author'] as { name: string }).name).toBe('Tác Giả 1')
  })
})

describe('seoService.getChapterPage', () => {
  const baseChapterData = {
    story: baseStoryDto,
    chapter: {
      _id: 'chap1',
      storyId: baseStoryDto._id,
      slug: 'chuong-1',
      title: 'Chương 1',
      order: 1,
      contentHtml: '<p>Nội dung chương 1</p>',
      wordCount: 1000,
      status: 'published',
      moderationStatus: 'approved',
      viewCount: 500,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    prev: null,
    next: { slug: 'chuong-2', title: 'Chương 2', order: 2 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns chapter page data with correct meta', async () => {
    mockSeoRepo.findPublicChapter.mockResolvedValue(baseChapterData)

    const result = await seoService.getChapterPage('truyen-test', 'chuong-1')

    expect(result.chapter.slug).toBe('chuong-1')
    expect(result.meta.canonical).toBe('https://iutruyen.vn/stories/truyen-test/chapters/chuong-1')
    expect(result.meta.indexable).toBe(true)
    expect(result.meta.og.type).toBe('article')
  })

  it('throws 404 when chapter not found', async () => {
    mockSeoRepo.findPublicChapter.mockResolvedValue(null)

    await expect(seoService.getChapterPage('truyen-test', 'khong-ton-tai')).rejects.toThrow(AppError)
  })

  it('sets indexable=false for mature chapter', async () => {
    mockSeoRepo.findPublicChapter.mockResolvedValue({
      ...baseChapterData,
      story: { ...baseStoryDto, contentWarning: 'mature18+' },
    })

    const result = await seoService.getChapterPage('truyen-mature', 'chuong-1')

    expect(result.meta.indexable).toBe(false)
    expect(result.meta.jsonLd).toBeNull()
  })

  it('builds correct Article JSON-LD with isPartOf Book', async () => {
    mockSeoRepo.findPublicChapter.mockResolvedValue(baseChapterData)

    const result = await seoService.getChapterPage('truyen-test', 'chuong-1')
    const jsonLd = result.meta.jsonLd as Record<string, unknown>

    expect(jsonLd['@type']).toBe('Article')
    expect((jsonLd['isPartOf'] as { '@type': string })['@type']).toBe('Book')
  })

  it('provides prev/next navigation', async () => {
    mockSeoRepo.findPublicChapter.mockResolvedValue(baseChapterData)

    const result = await seoService.getChapterPage('truyen-test', 'chuong-1')

    expect(result.prev).toBeNull()
    expect(result.next?.slug).toBe('chuong-2')
  })
})

describe('seoService.getCatalogPage', () => {
  const mockStories = {
    stories: [
      {
        _id: { toString: () => 'story1' },
        slug: 'truyen-1',
        title: 'Truyện 1',
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
        originalAuthor: undefined,
        sourceName: undefined,
        authorId: { username: 'user1', displayName: 'User 1' },
        genreIds: [{ _id: '507f1f77bcf86cd799439013', name: 'Tiên Hiệp', slug: 'tien-hiep' }],
        tagIds: [],
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ],
    meta: { hasMore: false, nextCursor: null, limit: 20 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockStoryRepo.findStories.mockResolvedValue(mockStories as never)
    mockStoryRepo.getRanking.mockResolvedValue(mockStories as never)
  })

  it.each(['home', 'stories', 'ranking'] as const)('returns catalog for kind=%s', async (kind) => {
    const result = await seoService.getCatalogPage(kind)
    expect(result.stories).toHaveLength(1)
    expect(result.meta.indexable).toBe(true)
  })

  it('sets correct canonical for home', async () => {
    const result = await seoService.getCatalogPage('home')
    expect(result.meta.canonical).toBe('https://iutruyen.vn/')
  })

  it('sets correct canonical for stories', async () => {
    const result = await seoService.getCatalogPage('stories')
    expect(result.meta.canonical).toBe('https://iutruyen.vn/stories')
  })
})

describe('seoService.getCoverData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null coverUrl when story has no cover', async () => {
    mockSeoRepo.findCoverForPublicStory.mockResolvedValue({ coverUrl: null })

    const result = await seoService.getCoverData('507f1f77bcf86cd799439011')
    expect(result.coverUrl).toBeNull()
  })

  it('throws 404 when story not public', async () => {
    mockSeoRepo.findCoverForPublicStory.mockResolvedValue(null)

    await expect(seoService.getCoverData('507f1f77bcf86cd799439011')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('seoService.buildSitemapManifestData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds story shards with batch scan', async () => {
    mockSeoRepo.scanStoryIds
      .mockResolvedValueOnce({ ids: ['id1', 'id2', 'id3'], lastId: 'id3' })
      .mockResolvedValueOnce({ ids: [], lastId: null })

    const result = await seoService.buildSitemapManifestData('stories')
    expect(result.shards.length).toBeGreaterThan(0)
    expect(result.shards[0]).toContain('id1')
  })

  it('returns empty shards when no documents', async () => {
    mockSeoRepo.scanStoryIds.mockResolvedValue({ ids: [], lastId: null })

    const result = await seoService.buildSitemapManifestData('stories')
    expect(result.shards).toHaveLength(0)
  })

  it('builds chapter shards', async () => {
    mockSeoRepo.scanChapterIds
      .mockResolvedValueOnce({ ids: ['c1', 'c2'], lastId: 'c2' })
      .mockResolvedValueOnce({ ids: [], lastId: null })

    const result = await seoService.buildSitemapManifestData('chapters')
    expect(result.shards[0]).toContain('c1')
  })
})
