import api from '@/lib/axios'
import type { ApiResponse } from '@/types/auth'
import type { User, PublicUserProfile } from '@/types/user'

export const getMeApi = async (): Promise<ApiResponse<User>> => {
  const response = await api.get<ApiResponse<User>>('/users/me')
  return response.data
}

export const updateMeApi = async (data: {
  displayName?: string
  bio?: string
}): Promise<ApiResponse<User>> => {
  const response = await api.patch<ApiResponse<User>>('/users/me', data)
  return response.data
}

export const updateAvatarApi = async (
  avatarBase64: string
): Promise<ApiResponse<{ avatarUrl: string }>> => {
  const response = await api.patch<ApiResponse<{ avatarUrl: string }>>('/users/me/avatar', {
    avatarBase64,
  })
  return response.data
}

export const changePasswordApi = async (data: {
  oldPassword: string
  newPassword: string
}): Promise<ApiResponse<null>> => {
  const response = await api.patch<ApiResponse<null>>('/users/me/password', data)
  return response.data
}

export const changeEmailApi = async (data: {
  newEmail: string
  oldPassword: string
}): Promise<ApiResponse<{ email: string }>> => {
  const response = await api.patch<ApiResponse<{ email: string }>>('/users/me/email', data)
  return response.data
}

export const becomeAuthorApi = async (): Promise<ApiResponse<{ authorStatus: string }>> => {
  const response = await api.post<ApiResponse<{ authorStatus: string }>>('/users/me/become-author')
  return response.data
}

export const getPublicProfileApi = async (id: string): Promise<ApiResponse<PublicUserProfile>> => {
  const response = await api.get<ApiResponse<PublicUserProfile>>(`/users/${id}/public-profile`)
  return response.data
}
