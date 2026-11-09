import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(), initialize: vi.fn(), binding: vi.fn(), atomicCreate: vi.fn(),
  genres: vi.fn(), tags: vi.fn(), slug: vi.fn(), create: vi.fn(), byId: vi.fn(),
}))
vi.mock('../../chapters/crawler.config.js', () => ({ resolveSource: mocks.resolve }))
vi.mock('../../../repositories/crawler-story-source.repository.js', () => ({ crawlerStorySourceRepository: {
  initialize: mocks.initialize, find: mocks.binding, createStory: mocks.atomicCreate,
} }))
vi.mock('../../../repositories/story.repository.js', () => ({ storyRepository: { findBySlug: mocks.slug, create: mocks.create, findById: mocks.byId } }))
vi.mock('../../../repositories/genre.repository.js', () => ({ genreRepository: { findByIds: mocks.genres } }))
vi.mock('../../../repositories/tag.repository.js', () => ({ tagRepository: { findByNamesOrCreate: mocks.tags } }))
vi.mock('../../../common/logger.js', () => ({ logger: { info: vi.fn() } }))

import { createStory } from '../stories.service.js'
import { createStorySchema, updateStorySchema } from '../stories.validation.js'
import { AppError } from '../../../common/AppError.js'

const actorId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const sourceUrl = 'https://books.example.org/story/'
const story = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', title: 'Truyện kiểm thử' }
const input = () => createStorySchema.parse({ title: story.title, description: 'Giới thiệu do bộ kiểm thử tạo.', genreIds: ['cccccccccccccccccccccccc'], crawlerSourceUrl: sourceUrl + '#catalog' })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolve.mockReturnValue({ url: new URL(sourceUrl) })
  mocks.binding.mockResolvedValue(null)
  mocks.genres.mockResolvedValue([{ _id: 'cccccccccccccccccccccccc' }])
  mocks.slug.mockResolvedValue(null)
  mocks.atomicCreate.mockResolvedValue(story)
  mocks.create.mockResolvedValue(story)
  mocks.byId.mockResolvedValue(story)
})

describe('creating a story with crawler provenance', () => {
  it('creates source and Story through the same atomic repository operation', async () => {
    expect(await createStory(actorId, input())).toEqual(story)
    expect(mocks.resolve).toHaveBeenCalledWith(sourceUrl + '#catalog')
    expect(mocks.atomicCreate).toHaveBeenCalledWith(expect.objectContaining({ title: story.title, moderationStatus: 'pending' }), sourceUrl)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('rejects a source already registered anywhere before genre/tag writes and Story creation', async () => {
    mocks.binding.mockResolvedValue({ storyId: 'private-story-id' })
    await expect(createStory(actorId, input())).rejects.toMatchObject({ statusCode: 409, code: 'CRAWLER_STORY_EXISTS' })
    expect(mocks.genres).not.toHaveBeenCalled()
    expect(mocks.tags).not.toHaveBeenCalled()
    expect(mocks.atomicCreate).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('rejects a disabled/unsafe source without reserving it or creating a Story', async () => {
    mocks.resolve.mockImplementation(() => { throw AppError.badRequest('Nguồn không được bật', 'CRAWLER_SOURCE_DISABLED') })
    await expect(createStory(actorId, input())).rejects.toMatchObject({ code: 'CRAWLER_SOURCE_DISABLED' })
    expect(mocks.initialize).not.toHaveBeenCalled()
    expect(mocks.atomicCreate).not.toHaveBeenCalled()
  })
  it('retains ordinary story creation when crawler provenance is not provided', async () => {
    const { crawlerSourceUrl: _source, ...ordinary } = input()
    await createStory(actorId, ordinary)
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(mocks.initialize).not.toHaveBeenCalled()
    expect(mocks.atomicCreate).not.toHaveBeenCalled()
  })
  it('does not accept source identity edits through the ordinary update schema', () => {
    expect(updateStorySchema.parse({ crawlerSourceUrl: sourceUrl })).not.toHaveProperty('crawlerSourceUrl')
  })
})
