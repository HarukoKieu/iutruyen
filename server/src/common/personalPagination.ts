import { z } from 'zod'
import { Types } from 'mongoose'
import { AppError } from './AppError.js'
import { decodeCursor, encodeCursor } from './pagination.js'

export const personalListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(512).optional(),
})
export function personalCursorFilter(cursor: string | undefined, field: 'createdAt' | 'lastReadAt') {
  if (!cursor) return {}
  const value = decodeCursor(cursor)
  if (!value || typeof value.id !== 'string' || !/^[a-f\d]{24}$/i.test(value.id) ||
      typeof value.at !== 'string' || !Number.isFinite(Date.parse(value.at))) {
    throw AppError.badRequest('Cursor không hợp lệ', 'INVALID_CURSOR')
  }
  const at = new Date(value.at)
  return { $or: [{ [field]: { $lt: at } }, { [field]: at, _id: { $lt: new Types.ObjectId(value.id) } }] }
}
/** Cursor uses the scanned rows, including hidden targets, to guarantee forward progress. */
export function personalPage<T extends { _id: Types.ObjectId; createdAt: Date; lastReadAt?: Date }>(
  rows: T[], limit: number, field: 'createdAt' | 'lastReadAt', visible: (row: T) => unknown = () => true,
) {
  const hasMore = rows.length > limit
  const scanned = rows.slice(0, limit), last = scanned.at(-1)
  return {
    items: scanned.filter(visible),
    meta: { limit, hasMore, nextCursor: hasMore && last ? encodeCursor({ id: String(last._id), at: last[field]!.toISOString() }) : null },
  }
}
