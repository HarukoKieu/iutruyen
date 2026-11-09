import { describe, it, expect } from 'vitest'
import { Request } from 'express'
import {
  parseCursorPagination,
  encodeCursor,
  decodeCursor,
  buildCursorMeta,
} from '../pagination.js'

describe('Cursor Pagination Helpers', () => {
  it('should parse cursor and limit from request query', () => {
    const req = {
      query: { cursor: 'abc123xyz', limit: '30' },
    } as unknown as Request

    const { cursor, limit } = parseCursorPagination(req)
    expect(cursor).toBe('abc123xyz')
    expect(limit).toBe(30)
  })

  it('should use default limit 20 and cap max limit at 100', () => {
    const reqDefault = { query: {} } as unknown as Request
    expect(parseCursorPagination(reqDefault)).toEqual({ cursor: null, limit: 20 })

    const reqMax = { query: { limit: '500' } } as unknown as Request
    expect(parseCursorPagination(reqMax)).toEqual({ cursor: null, limit: 100 })
  })

  it('should encode and decode cursor payload correctly (Roundtrip)', () => {
    const payload = {
      createdAt: '2026-08-20T10:00:00.000Z',
      id: 'story-id-666',
    }

    const encoded = encodeCursor(payload)
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(0)

    const decoded = decodeCursor(encoded)
    expect(decoded).toEqual(payload)
  })

  it('should return null when decoding invalid cursor', () => {
    expect(decodeCursor('invalid-not-base64-json')).toBeNull()
    expect(decodeCursor(null)).toBeNull()
    expect(decodeCursor(undefined)).toBeNull()
  })

  it('should build cursor meta structure', () => {
    const meta = buildCursorMeta(20, 'next-cursor-token', true)
    expect(meta).toEqual({
      limit: 20,
      nextCursor: 'next-cursor-token',
      hasMore: true,
    })
  })
})
