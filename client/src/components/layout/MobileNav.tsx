import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Library, User as UserIcon } from 'lucide-react'
import { useAuthStore } from '@/features/auth/store/authStore'

/**
 * MobileNav — Bottom Navigation Bar (3 tabs)
 * Trang chủ | Tủ sách | Tôi
 * Hiển thị trên mobile (lg:hidden), chiều cao 56px + safe-area padding.
 */
export const MobileNav: React.FC = () => {
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()

  const isActive = (path: string, search?: string) => {
    if (search) return location.pathname.startsWith(path.split('?')[0]) && location.search.includes(search)
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const navItems = [
    { label: 'Trang chủ', path: '/', icon: Home },
    {
      label: 'Tủ sách',
      path: isAuthenticated ? '/profile/library' : '/login',
      icon: Library,
    },
    {
      label: isAuthenticated ? 'Tôi' : 'Đăng nhập',
      path: isAuthenticated ? '/profile' : '/login',
      icon: UserIcon,
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border-subtle bg-card/95 backdrop-blur-lg pb-safe"
      aria-label="Điều hướng chính"
    >
      <div className="flex h-14 items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-0.5 transition-colors ${active ? 'text-link' : 'text-muted-foreground hover:text-foreground'
                }`}
              aria-current={active ? 'page' : undefined}
            >
              {/* Icon with active indicator dot */}
              <div className="relative">
                <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                )}
              </div>
              <span className={`text-[10px] mt-1 ${active ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default MobileNav
