import { afterEach, describe, expect, it, vi } from 'vitest'
import axios, { AxiosError, AxiosHeaders } from 'axios'
import { api } from './axios'
import { useAuthStore } from '@/features/auth/store/authStore'
import { queryClient } from './queryClient'

const adapter = api.defaults.adapter
afterEach(() => {
  api.defaults.adapter = adapter
  vi.restoreAllMocks()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  queryClient.clear()
})

describe('Requests after logout', () => {
  it('rejects a guest 401 without refreshing or clearing public stories', async () => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    queryClient.setQueryData(['story', 'tru-tien'], { title: 'Tru tiên' })
    const refresh = vi.spyOn(axios, 'post')
    api.defaults.adapter = async config => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined,
        { status: 401, statusText: 'Unauthorized', headers: new AxiosHeaders(), config, data: {} })
    }
    await expect(api.get('/notifications')).rejects.toMatchObject({ response: { status: 401 } })
    expect(refresh).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(['story', 'tru-tien'])).toEqual({ title: 'Tru tiên' })
  })

  it('does not erase public data when logout is repeated while already logged out', () => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    queryClient.setQueryData(['story', 'tru-tien'], { title: 'Tru tiên' })
    useAuthStore.getState().logout()
    expect(queryClient.getQueryData(['story', 'tru-tien'])).toEqual({ title: 'Tru tiên' })
  })
})
