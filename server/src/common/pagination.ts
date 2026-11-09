import { Request } from 'express'

export type CursorValue = string | number | null
export type CursorPayload = Record<string, CursorValue>

export interface CursorPaginationParams {
  cursor: string | null
  limit: number
}

export interface CursorPaginationMeta {
  limit: number
  nextCursor: string | null
  hasMore: boolean
}

export const parseCursorPagination = (req: Request): CursorPaginationParams => {
  const cursor =
    typeof req.query.cursor === 'string' && req.query.cursor.trim() !== ''
      ? req.query.cursor.trim()
      : null

  const limitRaw = parseInt(req.query.limit as string, 10)
  let limit = !isNaN(limitRaw) && limitRaw >= 1 ? limitRaw : 20
  if (limit > 100) {
    limit = 100
  }

  return { cursor, limit }
}

export const encodeCursor = <T extends CursorPayload = CursorPayload>(payload: T): string => {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export const decodeCursor = <T extends CursorPayload = CursorPayload>(
  cursor: string | null | undefined
): T | null => {
  if (!cursor) return null
  try {
    const jsonStr = Buffer.from(cursor, 'base64url').toString('utf8')
    const decoded = JSON.parse(jsonStr)
    if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
      return decoded as T
    }
    return null
  } catch {
    return null
  }
}

export const buildCursorMeta = (
  limit: number,
  nextCursor: string | null,
  hasMore: boolean
): CursorPaginationMeta => {
  return {
    limit,
    nextCursor,
    hasMore,
  }
}
