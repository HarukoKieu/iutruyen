import api from '@/lib/axios'
import type { ApiResponse, LoginResponseData, RegisterResponseData } from '@/types/auth'

export const loginApi = async (data: { email: string; password: string }): Promise<ApiResponse<LoginResponseData>> => {
  const response = await api.post<ApiResponse<LoginResponseData>>('/auth/login', data)
  return response.data
}

export const registerApi = async (data: {
  email: string
  username: string
  password: string
}): Promise<ApiResponse<RegisterResponseData>> => {
  const response = await api.post<ApiResponse<RegisterResponseData>>('/auth/register', data)
  return response.data
}

export const logoutApi = async (): Promise<ApiResponse<null>> => {
  const response = await api.post<ApiResponse<null>>('/auth/logout')
  return response.data
}

export const verifyEmailApi = async (
  data: string | { code?: string; token?: string }
): Promise<ApiResponse<null>> => {
  const payload = typeof data === 'string' ? { token: data } : data
  const response = await api.post<ApiResponse<null>>('/auth/verify-email', payload)
  return response.data
}

export const forgotPasswordApi = async (email: string): Promise<ApiResponse<null>> => {
  const response = await api.post<ApiResponse<null>>('/auth/forgot-password', { email })
  return response.data
}

export const resetPasswordApi = async (data: {
  token: string
  newPassword: string
}): Promise<ApiResponse<null>> => {
  const response = await api.post<ApiResponse<null>>('/auth/reset-password', data)
  return response.data
}
