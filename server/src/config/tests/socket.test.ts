import { describe, it, expect } from 'vitest'
import { extractSocketToken } from '../socket.js'

describe('Socket Helper Functions', () => {
  describe('extractSocketToken', () => {
    it('should extract token from handshake auth.token (raw)', () => {
      const mockSocket = {
        handshake: {
          auth: { token: 'jwt-sample-token' },
          headers: {},
        },
      } as any

      const token = extractSocketToken(mockSocket)
      expect(token).toBe('jwt-sample-token')
    })

    it('should extract token from handshake auth.token with Bearer prefix', () => {
      const mockSocket = {
        handshake: {
          auth: { token: 'Bearer jwt-sample-token' },
          headers: {},
        },
      } as any

      const token = extractSocketToken(mockSocket)
      expect(token).toBe('jwt-sample-token')
    })

    it('should extract token from Authorization header if auth.token missing', () => {
      const mockSocket = {
        handshake: {
          auth: {},
          headers: {
            authorization: 'Bearer header-token-123',
          },
        },
      } as any

      const token = extractSocketToken(mockSocket)
      expect(token).toBe('header-token-123')
    })

    it('should extract token from cookie header if others missing', () => {
      const mockSocket = {
        handshake: {
          auth: {},
          headers: {
            cookie: 'theme=dark; accessToken=cookie-token-456; other=1',
          },
        },
      } as any

      const token = extractSocketToken(mockSocket)
      expect(token).toBe('cookie-token-456')
    })

    it('should return null if no token is found', () => {
      const mockSocket = {
        handshake: {
          auth: {},
          headers: {},
        },
      } as any

      const token = extractSocketToken(mockSocket)
      expect(token).toBeNull()
    })
  })
})
