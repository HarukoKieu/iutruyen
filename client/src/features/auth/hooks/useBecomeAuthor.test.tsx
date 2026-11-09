import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import { useBecomeAuthor } from './useUser'
import { becomeAuthorApi, updateMeApi } from '../api/users.api'
import { useAuthStore } from '../store/authStore'
import { queryKeys } from '@/constants/queryKeys'
import type { User } from '@/types/user'

vi.mock('../api/users.api', () => ({ becomeAuthorApi: vi.fn(), updateMeApi: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const user: User = {
  id: 'reader', email: 'reader@example.com', username: 'reader', displayName: 'Độc giả',
  bio: 'Thích đọc truyện', role: 'user', isEmailVerified: true,
}
const profile = { displayName: 'Bút danh mới', bio: 'Tôi viết truyện.' }
const approvedRequest = { success: true, data: { authorStatus: 'pending' }, message: 'Đã gửi đơn' }

function setup() {
  const cache = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  return { ...renderHook(() => useBecomeAuthor(), { wrapper }), cache }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetAllMocks()
  useAuthStore.setState({ user: { ...user }, accessToken: 'token', isAuthenticated: true, hasHydrated: true })
  vi.mocked(updateMeApi).mockResolvedValue({ success: true, data: { ...user, ...profile } })
  vi.mocked(becomeAuthorApi).mockResolvedValue(approvedRequest)
})

it('saves the profile before sending a request without a body and marks the same user pending', async () => {
  const { result, cache } = setup()
  const invalidate = vi.spyOn(cache, 'invalidateQueries')
  await act(async () => { await result.current.mutateAsync(profile) })
  expect(updateMeApi).toHaveBeenCalledWith(profile)
  expect(becomeAuthorApi).toHaveBeenCalledWith()
  expect(vi.mocked(updateMeApi).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(becomeAuthorApi).mock.invocationCallOrder[0])
  expect(useAuthStore.getState().user).toMatchObject({ id: user.id, ...profile, authorStatus: 'pending' })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.users.me })
})

it('does not send an author request when the profile cannot be saved', async () => {
  const failure = new Error('Không lưu được hồ sơ')
  vi.mocked(updateMeApi).mockRejectedValue(failure)
  const { result } = setup()
  await act(async () => { await expect(result.current.mutateAsync(profile)).rejects.toBe(failure) })
  expect(becomeAuthorApi).not.toHaveBeenCalled()
  expect(useAuthStore.getState().user).toEqual(user)
})

it('keeps a successfully saved profile visible when the author request fails', async () => {
  const failure = new Error('Không gửi được đơn')
  vi.mocked(becomeAuthorApi).mockRejectedValue(failure)
  const { result } = setup()
  await act(async () => { await expect(result.current.mutateAsync(profile)).rejects.toBe(failure) })
  expect(useAuthStore.getState().user).toMatchObject(profile)
  expect(useAuthStore.getState().user?.authorStatus).toBeUndefined()
})

it('skips the profile update when the existing public profile is unchanged', async () => {
  const { result } = setup()
  await act(async () => { await result.current.mutateAsync({ displayName: user.displayName, bio: user.bio! }) })
  expect(updateMeApi).not.toHaveBeenCalled()
  expect(becomeAuthorApi).toHaveBeenCalledOnce()
})

it('does not restore the user when a pending request completes after logout', async () => {
  const request = deferred<typeof approvedRequest>()
  vi.mocked(becomeAuthorApi).mockReturnValue(request.promise)
  const { result } = setup()
  let completion!: ReturnType<typeof result.current.mutateAsync>
  act(() => { completion = result.current.mutateAsync({ displayName: user.displayName, bio: user.bio! }) })
  await waitFor(() => expect(becomeAuthorApi).toHaveBeenCalledOnce())
  act(() => { useAuthStore.getState().logout() })
  await act(async () => { request.resolve(approvedRequest); await completion })
  expect(useAuthStore.getState().user).toBeNull()
  expect(useAuthStore.getState().isAuthenticated).toBe(false)
})

it('does not submit for another account when the signed-in user changes while saving', async () => {
  const save = deferred<Awaited<ReturnType<typeof updateMeApi>>>()
  vi.mocked(updateMeApi).mockReturnValue(save.promise)
  const { result } = setup()
  let completion!: ReturnType<typeof result.current.mutateAsync>
  act(() => { completion = result.current.mutateAsync(profile) })
  const failed = completion.catch((error: unknown) => error)
  await waitFor(() => expect(updateMeApi).toHaveBeenCalledOnce())
  const otherUser = { ...user, id: 'other-reader' }
  act(() => { useAuthStore.setState({ user: otherUser }) })
  await act(async () => { save.resolve({ success: true, data: { ...user, ...profile } }); await failed })
  expect(becomeAuthorApi).not.toHaveBeenCalled()
  expect(useAuthStore.getState().user).toEqual(otherUser)
})
