import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '@/lib/axios'
import type { LoginResponseData, ApiResponse } from '@/types/auth'
import { toast } from 'sonner'

export const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const res = await api.post<ApiResponse<LoginResponseData>>('/auth/refresh', {})
        if (cancelled) return
        setAuth(res.data.data.user, res.data.data.accessToken)
        toast.success('Đăng nhập thành công')
        navigate('/', { replace: true })
      } catch {
        if (cancelled) return
        useAuthStore.getState().logout()
        toast.error('Không thể lấy thông tin tài khoản')
        navigate('/login', { replace: true })
      }
    }

    let cancelled = false
    void handleAuth()
    return () => { cancelled = true }
  }, [navigate, setAuth])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div role="status" className="text-center space-y-3">
        <div aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground">Đang hoàn tất đăng nhập...</p>
      </div>
    </main>
  )
}

export default OAuthCallbackPage
