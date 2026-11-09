import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/authStore'
import type { UserRole } from '@/types/user'

interface RequireRoleProps {
  roles: UserRole[]
  children: React.ReactNode
}

export const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const location = useLocation()
  const { user, isAuthenticated, hasHydrated } = useAuthStore()

  if (!hasHydrated) return <p role="status" className="p-6">Đang khôi phục phiên đăng nhập…</p>

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!user || !roles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold mb-2 text-foreground">Không có quyền truy cập</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Tài khoản của bạn chưa có quyền truy cập khu vực này. Vui lòng liên hệ quản trị viên nếu bạn nghĩ đây là lỗi.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          ← Quay về trang chủ
        </a>
      </div>
    )
  }

  return <>{children}</>
}

export default RequireRole
