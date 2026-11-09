import { describe, expect, it } from 'vitest'
import { crawlerJobCreateSchema, crawlerJobControlSchema, crawlerTasksQuerySchema } from '../crawler-job.validation.js'

const id = '123456789012345678901234'
const source = { url: 'https://books.example.org/story', storyId: id }
const input = { requestKey: '12345678-1234-4234-8234-123456789012', sources: [source] }
describe('bounded bulk crawler contract', () => {
  it('sets deterministic range defaults', () => {
    expect(crawlerJobCreateSchema.parse(input).sources[0]).toMatchObject({ from: 1, to: 2000, startOrder: 1 })
  })
  it.each([
    { sources: [] }, { sources: Array.from({ length: 21 }, (_, i) => ({ ...source, storyId: undefined, genreIds: [id], url: `https://books.example.org/${i}` })) },
    { sources: [{ ...source, url: 'invalid' }] }, { sources: [{ ...source, from: 5, to: 4 }] },
    { sources: [{ ...source, from: 1, to: 2001 }] }, { sources: [{ ...source, startOrder: 1_000_000 }] },
    { sources: [{ ...source, genreIds: [id] }] },
    { sources: [source, { ...source, url: 'https://books.example.org/other' }] },
    { sources: [source, { url: `${source.url}#fragment`, genreIds: [id] }] },
    { sources: [{ ...source, nextSelector: 'body' }] },
  ])('rejects unsafe or ambiguous plans %j', patch => {
    expect(crawlerJobCreateSchema.safeParse({ ...input, ...patch }).success).toBe(false)
  })
  it('requires rights only when starting, and rejects unknown actions/fields', () => {
    expect(crawlerJobControlSchema.safeParse({ action: 'start' }).success).toBe(false)
    expect(crawlerJobControlSchema.safeParse({ action: 'start', rightsConfirmed: true }).success).toBe(true)
    expect(crawlerJobControlSchema.safeParse({ action: 'pause' }).success).toBe(true)
    expect(crawlerJobControlSchema.safeParse({ action: 'start', rightsConfirmed: true, force: true }).success).toBe(false)
  })
  it('allows source-only lookup so an existing global source can be reused or skipped before genre validation', () => {
    expect(crawlerJobCreateSchema.parse({ ...input, sources: [{ url: source.url }] }).sources[0]).toMatchObject({ url: source.url })
  })
  it('bounds cursor lists and rejects unsupported status', () => {
    expect(crawlerTasksQuerySchema.parse({ limit: '100', status: 'failed' }).limit).toBe(100)
    expect(crawlerTasksQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
    expect(crawlerTasksQuerySchema.safeParse({ status: 'running' }).success).toBe(false)
  })
})
