import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { User } from '@/types/user'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useChapterDetail } from './useChapterDetail'
import { chaptersApi } from '../api/chapters.api'

vi.mock('../api/chapters.api', () => ({ chaptersApi: { getChapterBySlug: vi.fn(async () => ({ chapter: { _id: 'chapter' }, story: { _id: 'story' } })) } }))
const user = { id: 'reader', username: 'reader', role: 'user' } as User
let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

describe('reader auth hydration and session isolation', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, hasHydrated: false })
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300000 } } })
    client.setQueryData(['chapter', 'story', 'chapter', 'public'], { chapter: { _id: 'ssr' }, story: { _id: 'story' } })
    vi.clearAllMocks()
  })
  afterEach(() => { cleanup(); client.clear() })
  it.each([false, true])('issues one read after guest/persisted-user hydration (%s)', async loggedIn => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: loggedIn ? user : null, isAuthenticated: loggedIn }, version: 0 }))
    const hook = renderHook(() => useChapterDetail('story', 'chapter'), { wrapper })
    expect(hook.result.current.data?.chapter._id).toBe('ssr')
    expect(chaptersApi.getChapterBySlug).not.toHaveBeenCalled()
    await act(async () => { await useAuthStore.persist.rehydrate() })
    await waitFor(() => expect(hook.result.current.data?.chapter._id).toBe('chapter'))
    expect(chaptersApi.getChapterBySlug).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(['chapter', 'story', 'chapter', 'reader'])).toBe(loggedIn ? hook.result.current.data : undefined)
  })
  it('unblocks reads after malformed storage and refetches on navigation/remount', async () => {
    localStorage.setItem('auth-storage', 'malformed-json')
    const hook = renderHook(({ chapter }) => useChapterDetail('story', chapter), { initialProps: { chapter: 'chapter' }, wrapper })
    await act(async () => { await useAuthStore.persist.rehydrate() })
    await waitFor(() => expect(chaptersApi.getChapterBySlug).toHaveBeenCalledTimes(1))
    hook.rerender({ chapter: 'next' })
    await waitFor(() => expect(chaptersApi.getChapterBySlug).toHaveBeenCalledTimes(2))
    hook.unmount()
    renderHook(() => useChapterDetail('story', 'next'), { wrapper })
    await waitFor(() => expect(chaptersApi.getChapterBySlug).toHaveBeenCalledTimes(3))
  })
  it('uses separate keys when the user logs in or logs out', async () => {
    useAuthStore.setState({ hasHydrated: true })
    renderHook(() => useChapterDetail('story', 'chapter'), { wrapper })
    await waitFor(() => expect(chaptersApi.getChapterBySlug).toHaveBeenCalledTimes(1))
    act(() => useAuthStore.getState().setAuth(user, 'fixture-token'))
    await waitFor(() => expect(chaptersApi.getChapterBySlug).toHaveBeenCalledTimes(2))
    expect(client.getQueryData(['chapter', 'story', 'chapter', 'reader'])).toBeDefined()
    act(() => useAuthStore.getState().logout())
    await waitFor(() => expect(chaptersApi.getChapterBySlug).toHaveBeenCalledTimes(3))
  })
  it('unblocks the reader when storage access is denied', async () => {
    const denied = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage denied') })
    try {
      renderHook(() => useChapterDetail('story', 'chapter'), { wrapper })
      await act(async () => { await useAuthStore.persist.rehydrate() })
      await waitFor(() => expect(chaptersApi.getChapterBySlug).toHaveBeenCalledTimes(1))
      expect(useAuthStore.getState().hasHydrated).toBe(true)
    } finally { denied.mockRestore() }
  })
})
