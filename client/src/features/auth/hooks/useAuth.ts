import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  loginApi,
  registerApi,
  logoutApi,
  verifyEmailApi,
  forgotPasswordApi,
  resetPasswordApi,
} from '../api/auth.api'
import { getMeApi } from '../api/users.api'
import { useTheme } from 'next-themes'
import { useAuthStore } from '../store/authStore'
import { useReaderSettingsStore } from '@/features/reader-settings/store/readerSettingsStore'
import { queryKeys } from '@/constants/queryKeys'

export const useLogin = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((state) => state.setAuth)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: loginApi,
    onSuccess: (response) => {
      const { user, accessToken } = response.data
      setAuth(user, accessToken)
      queryClient.setQueryData(queryKeys.users.me, response)
      toast.success(response.message || 'Đăng nhập thành công')
      const from = location.state?.from
      const pathname = typeof from?.pathname === 'string' ? from.pathname : '/'
      const isInternal = pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.includes('\\') && pathname !== '/login'
      navigate(isInternal ? {
        pathname,
        search: typeof from?.search === 'string' ? from.search : '',
        hash: typeof from?.hash === 'string' ? from.hash : '',
      } : '/', { replace: true })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Đăng nhập thất bại'
      toast.error(message)
    },
  })
}

export const useRegister = () => {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: registerApi,
    onSuccess: (response) => {
      const { user, accessToken } = response.data
      setAuth(user, accessToken)
      queryClient.setQueryData(queryKeys.users.me, response)
      toast.success(response.message || 'Đăng ký thành công!')
      navigate('/')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Đăng ký thất bại'
      toast.error(message)
    },
  })
}

export const useLogout = () => {
  const logout = useAuthStore((state) => state.logout)
  const queryClient = useQueryClient()
  const { setTheme } = useTheme()

  const resetThemeToDefault = () => {
    setTheme('light')
    useReaderSettingsStore.getState().setTheme('light')
  }

  return useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      logout()
      resetThemeToDefault()
      queryClient.clear()
      toast.success('Đã đăng xuất')
    },
    onError: () => {
      logout()
      resetThemeToDefault()
      queryClient.clear()
    },
  })
}

export const useCurrentUser = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const setUser = useAuthStore((state) => state.setUser)

  return useQuery({
    queryKey: queryKeys.users.me,
    queryFn: async () => {
      const res = await getMeApi()
      setUser(res.data)
      return res.data
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })
}

export const useVerifyEmail = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: verifyEmailApi,
    onSuccess: (response) => {
      // Confirmation may replace a recovery address and revoke the current session.
      useAuthStore.getState().logout()
      queryClient.clear()
      toast.success(response.message || 'Xác thực email thành công!')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Xác thực email thất bại'
      toast.error(message)
    },
  })
}

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: forgotPasswordApi,
    onSuccess: (response) => {
      toast.success(response.message || 'Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Gửi yêu cầu thất bại'
      toast.error(message)
    },
  })
}

export const useResetPassword = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resetPasswordApi,
    onSuccess: (response) => {
      useAuthStore.getState().logout()
      queryClient.clear()
      toast.success(response.message || 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.')
      navigate('/login')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Đặt lại mật khẩu thất bại'
      toast.error(message)
    },
  })
}
