import type { User } from './user'

export interface LoginResponseData {
  accessToken: string
  user: User
}

export interface RegisterResponseData {
  accessToken: string
  user: User
}

export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  meta?: any
  code?: string
  errors?: Array<{ field: string; message: string }>
}
