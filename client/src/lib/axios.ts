import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/features/auth/store/authStore'
import { API_BASE_URL } from './apiConfig'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor: attach accessToken from authStore
api.interceptors.request.use(
  (config) => {
    const accessToken = useAuthStore.getState().accessToken
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 401 Refresh Token Rotation with Pending Queue
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token!)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (!error.response || error.response.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error)
    }

    // Guest requests must never start a refresh/logout/cache-clear cycle.
    const session = useAuthStore.getState()
    if (!session.isAuthenticated) return Promise.reject(error)

    // Do not attempt refresh on auth endpoints to prevent infinite loop
    if (
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register')
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true
    if (isRefreshing) {
      // Queue request while another refresh is in flight
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`
          }
          return api(originalRequest)
        })
        .catch((err) => Promise.reject(err))
    }

    isRefreshing = true

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true, timeout: 15000 }
      )

      const newAccessToken = data.data.accessToken
      const newUser = data.data.user

      const currentSession = useAuthStore.getState()
      if (!currentSession.isAuthenticated || currentSession.user !== session.user || currentSession.accessToken !== session.accessToken) {
        processQueue(error, null)
        return Promise.reject(error)
      }

      useAuthStore.getState().setAuth(newUser, newAccessToken)
      processQueue(null, newAccessToken)

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      }
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      const currentSession = useAuthStore.getState()
      if (currentSession.isAuthenticated && currentSession.user === session.user && currentSession.accessToken === session.accessToken) {
        currentSession.logout()
      }
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export const axiosInstance = api
export default api

