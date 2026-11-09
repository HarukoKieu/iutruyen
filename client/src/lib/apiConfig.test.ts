import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('browser connection URLs', () => {
  it('uses the dev browser origin even with loopback backend URLs configured', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_API_URL', 'http://localhost:4000/api/v1')
    vi.stubEnv('VITE_SOCKET_URL', 'http://localhost:4000')
    vi.resetModules()

    const { API_BASE_URL, SOCKET_URL } = await import('./apiConfig')
    expect(new URL(API_BASE_URL + '/seo/catalog/home', window.location.origin).origin).toBe(window.location.origin)
    expect(API_BASE_URL).toBe('/api/v1')
    expect(SOCKET_URL).toBe(window.location.origin)
  })

  it('keeps explicit production API and socket services', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/api/v1')
    vi.stubEnv('VITE_SOCKET_URL', 'https://realtime.example.com')
    vi.resetModules()

    const { API_BASE_URL, SOCKET_URL } = await import('./apiConfig')
    expect(API_BASE_URL).toBe('https://api.example.com/api/v1')
    expect(SOCKET_URL).toBe('https://realtime.example.com')
  })

  it('can load during server rendering without accessing window', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_API_URL', 'http://localhost:4000/api/v1')
    vi.stubEnv('VITE_SOCKET_URL', 'http://localhost:4000')
    vi.stubGlobal('window', undefined)
    vi.resetModules()

    const { API_BASE_URL, SOCKET_URL } = await import('./apiConfig')
    expect(API_BASE_URL).toBe('http://localhost:4000/api/v1')
    expect(SOCKET_URL).toBe('http://localhost:4000')
  })

  it('preserves the existing fallback when production services are unset', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_API_URL', undefined)
    vi.stubEnv('VITE_SOCKET_URL', undefined)
    vi.resetModules()

    const { API_BASE_URL, SOCKET_URL } = await import('./apiConfig')
    expect(API_BASE_URL).toBe('http://localhost:4000/api/v1')
    expect(SOCKET_URL).toBe('http://localhost:4000')
  })
})
