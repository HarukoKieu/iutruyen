import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserStorage, browserSessionStorage } from './browserStorage'

describe('optional browser persistence', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear() })
  it('uses session storage independently of local preferences', () => {
    browserStorage.setItem('fixture', 'local')
    browserSessionStorage.setItem('fixture', 'session')
    expect(browserSessionStorage.getItem('fixture')).toBe('session')
    expect(browserStorage.getItem('fixture')).toBe('local')
    browserSessionStorage.removeItem('fixture')
    expect(browserSessionStorage.getItem('fixture')).toBeNull()
  })
  it('uses the existing storage keys and values when available', () => {
    browserStorage.setItem('fixture', 'value')
    expect(browserStorage.getItem('fixture')).toBe('value')
    browserStorage.removeItem('fixture')
    expect(browserStorage.getItem('fixture')).toBeNull()
  })
  it('contains access denied and quota errors without retaining a server-side fallback', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('Storage unavailable') })
    }
    expect(browserStorage.getItem('fixture')).toBeNull()
    expect(() => browserStorage.setItem('fixture', 'private data')).not.toThrow()
    expect(() => browserStorage.removeItem('fixture')).not.toThrow()
    expect(browserStorage.getItem('fixture')).toBeNull()
    expect(browserSessionStorage.getItem('fixture')).toBeNull()
    expect(() => browserSessionStorage.setItem('fixture', 'consent')).not.toThrow()
    expect(() => browserSessionStorage.removeItem('fixture')).not.toThrow()
  })
})
