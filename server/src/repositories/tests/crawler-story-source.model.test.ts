import { Types } from 'mongoose'
import { describe, expect, it } from 'vitest'
import { CrawlerStorySource } from '../../models/CrawlerStorySource.model.js'

const valid = { sourceHash: 'a'.repeat(64), sourceUrl: 'https://books.example.org/story/', storyId: new Types.ObjectId() }

describe('private source provenance schema', () => {
  it('retains exact URL provenance without changing Story or chapter fields', async () => {
    const mapping = new CrawlerStorySource(valid)
    await expect(mapping.validate()).resolves.toBeUndefined()
    expect(mapping.toObject()).toMatchObject(valid)
    expect(mapping.toObject()).not.toHaveProperty('contentHtml')
  })

  it.each([{ sourceHash: 'invalid' }, { sourceHash: '' }, { sourceUrl: 'x'.repeat(2049) }, { sourceUrl: '' }, { storyId: undefined }])('rejects invalid mapping %j', async patch => {
    await expect(new CrawlerStorySource({ ...valid, ...patch }).validate()).rejects.toBeDefined()
  })

  it('declares a global unique identity, a Story lookup index and no automatic TTL deletion', () => {
    const indexes = CrawlerStorySource.schema.indexes()
    expect(indexes).toContainEqual([{ sourceHash: 1 }, expect.objectContaining({ unique: true, name: 'crawler_story_source_identity' })])
    expect(indexes).toContainEqual([{ storyId: 1 }, expect.objectContaining({ name: 'crawler_story_source_story' })])
    expect(indexes.every(([, options]) => options.expireAfterSeconds === undefined)).toBe(true)
    expect(CrawlerStorySource.schema.options.versionKey).toBe(false)
  })
})
