import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePublicQueryPolicy } from './usePublicQueryPolicy'

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
const publicStory = { moderationStatus: 'approved', contentWarning: 'none' }
const publicRead = { story: publicStory, chapter: { status: 'published', moderationStatus: 'approved' } }
async function fail(key: QueryKey) {
  await client.fetchQuery({ queryKey: key, queryFn: async () => { throw new Error('Fixture outage') }, retry: false }).catch(() => undefined)
}

describe('public metadata resource and session scope', () => {
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['story', 'a'], publicStory)
  })
  afterEach(() => { cleanup(); client.clear() })

  it('keeps a valid story indexable after leaving an errored chapter', async () => {
    await fail(['chapter', 'a', 'old', 'public'])
    const hook = renderHook(() => usePublicQueryPolicy('a', undefined, 'public'), { wrapper })
    expect(hook.result.current).toBe(false)
  })
  it('ignores another chapter or session while showing the current chapter', async () => {
    await fail(['chapter', 'a', 'other', 'public'])
    await fail(['chapter', 'a', 'current', 'old-user'])
    client.setQueryData(['chapter', 'a', 'current', 'public'], publicRead)
    const hook = renderHook(() => usePublicQueryPolicy('a', 'current', 'public'), { wrapper })
    expect(hook.result.current).toBe(false)
  })
  it('switches policy when auth scope changes and restores it after recovery', async () => {
    await fail(['chapter', 'a', 'current', 'reader'])
    const hook = renderHook(({ scope }) => usePublicQueryPolicy('a', 'current', scope), { initialProps: { scope: 'public' }, wrapper })
    expect(hook.result.current).toBe(false)
    hook.rerender({ scope: 'reader' })
    expect(hook.result.current).toBe(true)
    act(() => client.setQueryData(['chapter', 'a', 'current', 'reader'], publicRead))
    await waitFor(() => expect(hook.result.current).toBe(false))
  })
  it('marks only the active story failure unavailable and recovers without reload', async () => {
    const hook = renderHook(() => usePublicQueryPolicy('a', undefined, 'public'), { wrapper })
    await act(async () => { await fail(['story', 'a']) })
    await waitFor(() => expect(hook.result.current).toBe(true))
    act(() => client.setQueryData(['story', 'a'], publicStory))
    await waitFor(() => expect(hook.result.current).toBe(false))
  })
  it('does not treat an inactive parent query outage as an outage of a valid reader', async () => {
    await fail(['story', 'a'])
    client.setQueryData(['chapter', 'a', 'current', 'public'], publicRead)
    const hook = renderHook(() => usePublicQueryPolicy('a', 'current', 'public'), { wrapper })
    expect(hook.result.current).toBe(false)
  })
  it.each([
    { story: { ...publicStory, moderationStatus: 'hidden' } },
    { story: { ...publicStory, contentWarning: 'mature18+' } },
    { chapter: { status: 'published', moderationStatus: 'pending' } },
    { chapter: { status: 'draft', moderationStatus: 'approved' } },
  ])('keeps current private/mature/draft content noindex (%j)', visibility => {
    client.setQueryData(['chapter', 'a', 'current', 'public'], { ...publicRead, ...visibility })
    const hook = renderHook(() => usePublicQueryPolicy('a', 'current', 'public'), { wrapper })
    expect(hook.result.current).toBe(true)
  })
  it('reacts to parent visibility changes and removal of an active failed query', async () => {
    const hook = renderHook(() => usePublicQueryPolicy('a', 'current', 'public'), { wrapper })
    act(() => client.setQueryData(['story', 'a'], { ...publicStory, moderationStatus: 'hidden' }))
    await waitFor(() => expect(hook.result.current).toBe(true))
    act(() => client.setQueryData(['story', 'a'], publicStory))
    await act(async () => { await fail(['chapter', 'a', 'current', 'public']) })
    expect(hook.result.current).toBe(true)
    act(() => client.removeQueries({ queryKey: ['chapter', 'a', 'current', 'public'], exact: true }))
    await waitFor(() => expect(hook.result.current).toBe(false))
  })
  it('does not consult an unrelated story on catalog pages', async () => {
    await fail(['story', 'unrelated'])
    const hook = renderHook(() => usePublicQueryPolicy('', undefined, 'public'), { wrapper })
    expect(hook.result.current).toBe(false)
  })
})
