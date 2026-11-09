import { describe, it, expect, vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { requestId } from '../requestId.js'

describe('requestId Middleware', () => {
  it('should reuse existing x-request-id header if present', () => {
    const req = {
      headers: { 'x-request-id': 'custom-req-id-999' },
    } as unknown as Request

    const setHeaderMock = vi.fn()
    const res = {
      setHeader: setHeaderMock,
    } as unknown as Response
    const next: NextFunction = vi.fn()

    requestId(req, res, next)

    expect(req.id).toBe('custom-req-id-999')
    expect(setHeaderMock).toHaveBeenCalledWith('X-Request-Id', 'custom-req-id-999')
    expect(next).toHaveBeenCalledWith()
  })

  it('should generate a new uuid if x-request-id header is missing', () => {
    const req = {
      headers: {},
    } as unknown as Request

    const setHeaderMock = vi.fn()
    const res = {
      setHeader: setHeaderMock,
    } as unknown as Response
    const next: NextFunction = vi.fn()

    requestId(req, res, next)

    expect(req.id).toBeDefined()
    expect(typeof req.id).toBe('string')
    expect(setHeaderMock).toHaveBeenCalledWith('X-Request-Id', req.id)
    expect(next).toHaveBeenCalledWith()
  })
})
