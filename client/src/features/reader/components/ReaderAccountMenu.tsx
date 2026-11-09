import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Bookmark, User as UserIcon, PenTool, ShieldCheck, LogOut, UserPlus } from 'lucide-react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useLogout } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/button'

export function ReaderAccountMenu() {
  const { user, isAuthenticated } = useAuthStore()
  const { mutate: logout } = useLogout()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const isAuthor = user?.role === 'author' || user?.role === 'admin'
  const canModerate = user?.role === 'moderator' || user?.role === 'admin'
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setIsUserMenuOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsUserMenuOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  return (<>
{isAuthenticated && user ? (
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((o) => !o)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="menu"
                aria-label={`Tài khoản: ${user.displayName || 'Người dùng'}`}
                title={user.displayName || 'Tài khoản'}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border-0 bg-transparent p-1 shadow-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="h-7 w-7 rounded-full bg-secondary text-link flex items-center justify-center font-bold text-xs overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    user.displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <span className="hidden 2xl:inline text-xs font-semibold text-foreground max-w-[80px] truncate">
                  {user.displayName}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>

              {isUserMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-card z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="text-xs font-bold text-foreground truncate">{user.displayName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary hover:text-link transition-colors"
                  >
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Hồ sơ cá nhân</span>
                  </Link>

                  <Link
                    to="/profile/library"
                    onClick={() => setIsUserMenuOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary hover:text-link transition-colors"
                  >
                    <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Tủ sách & Dấu trang</span>
                  </Link>

                  {isAuthor && (
                    <Link
                      to="/author/stories"
                      onClick={() => setIsUserMenuOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-link hover:bg-secondary transition-colors"
                    >
                      <PenTool className="h-3.5 w-3.5" />
                      <span>Quản lý tác phẩm</span>
                    </Link>
                  )}

                  {canModerate && (
                    <Link
                      to="/mod/chapters"
                      onClick={() => setIsUserMenuOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-link hover:bg-secondary transition-colors"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Kiểm duyệt</span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      logout()
                    }}
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors mt-1"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">Đăng nhập</Link>
              </Button>
              <Button asChild variant="default" size="sm">
                <Link to="/register">
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  Đăng ký
                </Link>
              </Button>
            </div>
          )}
</>)
}

