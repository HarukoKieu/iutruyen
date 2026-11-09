import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../authStore'
import type { User } from '@/types/user'

describe('useAuthStore', () => {
  const fakeUser: User = {
    id: 'user-999',
    email: 'reader@example.com',
    username: 'reader',
    displayName: 'Độc Giả 01',
    role: 'user',
    isEmailVerified: true,
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  }

  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('should initialize with logged out state', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('should update user and accessToken when calling setAuth', () => {
    useAuthStore.getState().setAuth(fakeUser, 'sample_access_token')

    const state = useAuthStore.getState()
    expect(state.user).toEqual(fakeUser)
    expect(state.accessToken).toBe('sample_access_token')
    expect(state.isAuthenticated).toBe(true)
  })

  it('should clear state on logout', () => {
    useAuthStore.getState().setAuth(fakeUser, 'sample_access_token')
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})
