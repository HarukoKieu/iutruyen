import mongoose, { Types, type ClientSession } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), create: vi.fn(), init: vi.fn(), listIndexes: vi.fn(), storyCreate: vi.fn() }))
vi.mock('../../models/CrawlerStorySource.model.js', () => ({ CrawlerStorySource: {
  findOne: mocks.findOne, create: mocks.create, init: mocks.init, listIndexes: mocks.listIndexes,
  schema: { indexes: () => [
    [{ sourceHash: 1 }, { unique: true, name: 'crawler_story_source_identity' }],
    [{ storyId: 1 }, { name: 'crawler_story_source_story' }],
  ] },
} }))
vi.mock('../../models/Story.model.js', () => ({ Story: { create: mocks.storyCreate } }))

import { crawlerStorySourceIdentity, crawlerStorySourceRepository as repository } from '../crawler-story-source.repository.js'

const rawUrl = 'https://books.example.org/story/?edition=1'
const storyId = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa')
const otherStoryId = new Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb')
const session = {
  inTransaction: vi.fn(), endSession: vi.fn(),
  withTransaction: vi.fn(async (work: () => Promise<unknown>) => work()),
}
const asSession = session as unknown as ClientSession
const query = (value: unknown) => ({ maxTimeMS: vi.fn().mockReturnThis(), session: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value) })
const mapping = () => ({ _id: new Types.ObjectId(), ...crawlerStorySourceIdentity(rawUrl), storyId, createdAt: new Date(), updatedAt: new Date() })
const indexes = () => [
  { name: 'crawler_story_source_identity', key: { sourceHash: 1 }, unique: true },
  { name: 'crawler_story_source_story', key: { storyId: 1 } },
]

beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks()
  session.inTransaction.mockReturnValue(true); session.endSession.mockResolvedValue(undefined)
  session.withTransaction.mockImplementation(async work => work())
  vi.spyOn(mongoose, 'startSession').mockResolvedValue(asSession)
  mocks.findOne.mockReset().mockImplementation(() => query(null))
  mocks.create.mockReset().mockImplementation(async () => [{ toObject: mapping }])
  mocks.storyCreate.mockReset().mockResolvedValue([{ _id: storyId, title: 'Truyện kiểm thử' }])
  mocks.init.mockResolvedValue(undefined); mocks.listIndexes.mockReset().mockResolvedValue(indexes())
})

describe('exact source URL identity', () => {
  it('normalizes hostname/default port and strips fragments while preserving the exact path/query', () => {
    const first = crawlerStorySourceIdentity('https://BOOKS.example.org:443/story/?edition=1#read')
    expect(first).toEqual(crawlerStorySourceIdentity(rawUrl))
    expect(first.sourceUrl).toBe(rawUrl)
    expect(first.sourceHash).toMatch(/^[a-f\d]{64}$/)
    expect(crawlerStorySourceIdentity('https://books.example.org/story/?edition=2').sourceHash).not.toBe(first.sourceHash)
    expect(crawlerStorySourceIdentity('https://books.example.org/Story/?edition=1').sourceHash).not.toBe(first.sourceHash)
  })

  it.each(['invalid', 'http://books.example.org/story/', 'https://user:pass@books.example.org/story/',
    'https://books.example.org:444/story/', 'https://127.0.0.1/story/', 'https://2130706433/story/',
    'https://[::1]/story/', 'https://[::ffff:127.0.0.1]/story/', `https://books.example.org/${'a'.repeat(2048)}`])('rejects unsafe identity %s', value => {
    expect(() => crawlerStorySourceIdentity(value)).toThrow(expect.objectContaining({ code: 'CRAWLER_URL', statusCode: 400 }))
  })
})

describe('private global source binding', () => {
  it('uses a bounded hash lookup and the supplied transaction session', async () => {
    const row = mapping(), lookup = query(row); mocks.findOne.mockReturnValueOnce(lookup)
    expect(await repository.find(rawUrl + '#chapter', asSession)).toBe(row)
    expect(mocks.findOne).toHaveBeenCalledWith({ sourceHash: crawlerStorySourceIdentity(rawUrl).sourceHash })
    expect(lookup.maxTimeMS).toHaveBeenCalledWith(5000); expect(lookup.session).toHaveBeenCalledWith(asSession)
  })

  it('returns the existing same-Story binding without inserting or changing it', async () => {
    const row = mapping(); mocks.findOne.mockReturnValueOnce(query(row))
    expect(await repository.bind(rawUrl, String(storyId), asSession)).toBe(row)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('rejects a source already bound to a different Story without exposing its ID', async () => {
    mocks.findOne.mockReturnValueOnce(query(mapping()))
    const operation = repository.bind(rawUrl, otherStoryId, asSession)
    await expect(operation).rejects.toMatchObject({ statusCode: 409, code: 'CRAWLER_SOURCE_CONFLICT' })
    await expect(operation).rejects.not.toThrow(String(storyId))
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('creates the private binding in the caller transaction', async () => {
    const result = await repository.bind(rawUrl + '#read', storyId, asSession)
    expect(result.storyId).toEqual(storyId)
    expect(mocks.create).toHaveBeenCalledWith([{ ...crawlerStorySourceIdentity(rawUrl), storyId }], { session: asSession })
  })

  it('does not continue an aborted transaction after an insert race', async () => {
    const error = { code: 11000, keyPattern: { sourceHash: 1 } }; mocks.create.mockRejectedValueOnce(error)
    await expect(repository.bind(rawUrl, storyId, asSession)).rejects.toBe(error)
    expect(mocks.findOne).toHaveBeenCalledTimes(1)
  })

  it('refuses a nontransactional binding', async () => {
    session.inTransaction.mockReturnValueOnce(false)
    await expect(repository.bind(rawUrl, storyId, asSession)).rejects.toMatchObject({ code: 'CRAWLER_STORAGE_UNAVAILABLE' })
    expect(mocks.findOne).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled()
  })

  it('fails closed if stored URL and hash lookup disagree', async () => {
    mocks.findOne.mockReturnValueOnce(query({ ...mapping(), sourceUrl: 'https://books.example.org/different/' }))
    await expect(repository.find(rawUrl)).rejects.toMatchObject({ code: 'CRAWLER_SOURCE_CONFLICT' })
  })
})

describe('Story creation with atomic provenance', () => {
  it('writes the Story and mapping in one majority transaction and closes the session', async () => {
    const data = { title: 'Truyện kiểm thử', slug: 'truyen-kiem-thu' }
    expect(await repository.createStory(data, rawUrl)).toMatchObject({ _id: storyId, title: data.title })
    expect(mocks.storyCreate).toHaveBeenCalledWith([data], { session: asSession })
    expect(mocks.create).toHaveBeenCalledWith([{ ...crawlerStorySourceIdentity(rawUrl), storyId }], { session: asSession })
    expect(session.withTransaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ timeoutMS: 15000, writeConcern: { w: 'majority' }, readConcern: { level: 'snapshot' } }))
    expect(session.endSession).toHaveBeenCalledTimes(1)
  })

  it('rejects an existing source before creating a Story, without returning the existing ID', async () => {
    mocks.findOne.mockReturnValueOnce(query(mapping()))
    const operation = repository.createStory({ title: 'Truyện mới' }, rawUrl)
    await expect(operation).rejects.toMatchObject({ code: 'CRAWLER_STORY_EXISTS', statusCode: 409 })
    await expect(operation).rejects.not.toThrow(String(storyId))
    expect(mocks.storyCreate).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled()
    expect(session.endSession).toHaveBeenCalledTimes(1)
  })

  it('converts a provenance unique-key race into a generic conflict after the transaction rejects', async () => {
    mocks.create.mockRejectedValueOnce({ code: 11000, keyPattern: { sourceHash: 1 } })
    await expect(repository.createStory({ title: 'Truyện mới' }, rawUrl)).rejects.toMatchObject({ code: 'CRAWLER_STORY_EXISTS', statusCode: 409 })
    expect(session.endSession).toHaveBeenCalledTimes(1)
  })

  it('does not mislabel an unrelated Story slug collision as an existing source', async () => {
    const error = { code: 11000, keyPattern: { slug: 1 } }; mocks.storyCreate.mockRejectedValueOnce(error)
    await expect(repository.createStory({ title: 'Truyện mới' }, rawUrl)).rejects.toBe(error)
    expect(mocks.create).not.toHaveBeenCalled(); expect(session.endSession).toHaveBeenCalledTimes(1)
  })
})

describe('source index readiness', () => {
  it('initializes development indexes and verifies production indexes without creating them', async () => {
    await repository.initialize(false); expect(mocks.init).toHaveBeenCalledTimes(1)
    mocks.init.mockClear(); await repository.initialize(true); expect(mocks.init).not.toHaveBeenCalled()
  })

  it.each(['missing', 'nonunique', 'partial', 'sparse', 'wrong-name'])('fails closed for %s global identity index', async failure => {
    const rows = indexes()
    if (failure === 'missing') rows.shift()
    else if (failure === 'nonunique') rows[0].unique = false
    else if (failure === 'partial') Object.assign(rows[0], { partialFilterExpression: { sourceHash: { $exists: true } } })
    else if (failure === 'sparse') Object.assign(rows[0], { sparse: true })
    else rows[0].name = 'different_name'
    mocks.listIndexes.mockResolvedValueOnce(rows)
    await expect(repository.initialize(true)).rejects.toMatchObject({ code: 'CRAWLER_INDEXES_MISSING', statusCode: 503 })
    expect(mocks.init).not.toHaveBeenCalled()
  })
})
