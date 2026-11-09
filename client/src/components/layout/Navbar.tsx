import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Search,
  Flame,
  Trophy,
  PenTool,
  Bookmark,
  LogOut,
  User as UserIcon,
  UserPlus,
  Layers,
  ChevronDown,
  BookCheck,
  History,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useLogout } from '@/features/auth/hooks/useAuth'
import { useGenres } from '@/features/stories/hooks/useGenres'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from './ThemeToggle'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { useNotificationSocket } from '@/features/notifications/hooks/useNotificationSocket'
import { ModerationBadgeBell } from '@/features/moderation/components/ModerationBadgeBell'
import { useModerationSocket } from '@/features/moderation/hooks/useModerationSocket'
import { SearchBar } from '@/features/search/components/SearchBar'
import { MobileStoryNavigation } from './MobileStoryNavigation'
import { ROUTES } from '@/constants/routes'



export const Navbar: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore()
  const { mutate: logout } = useLogout()
  const { data: genres = [] } = useGenres()
  const navigate = useNavigate()
  const location = useLocation()

  // Activate Socket.IO listeners
  useNotificationSocket()
  useModerationSocket()

  const [isGenresOpen, setIsGenresOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const genresMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
      if (genresMenuRef.current && !genresMenuRef.current.contains(event.target as Node)) {
        setIsGenresOpen(false)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isUserMenuOpen) userMenuRef.current?.querySelector('button')?.focus()
        if (isGenresOpen) genresMenuRef.current?.querySelector('button')?.focus()
        setIsUserMenuOpen(false)
        setIsGenresOpen(false)
      }
    }

    document.addEventListener('mousedown', closeMenus)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenus)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isUserMenuOpen, isGenresOpen])

  useEffect(() => {
    if (isUserMenuOpen) userMenuRef.current?.querySelector<HTMLAnchorElement>('a')?.focus()
    if (isGenresOpen) genresMenuRef.current?.querySelector<HTMLButtonElement>('[data-genre-option]')?.focus()
  }, [isUserMenuOpen, isGenresOpen])

  const isAuthor = user?.role === 'author' || user?.role === 'admin'
  const canModerate = user?.role === 'moderator' || user?.role === 'admin'

  const isActive = (path: string, search?: string) => {
    if (search) return location.search.includes(search)
    return location.pathname === path
  }

  const navLinkClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-colors text-sm font-medium ${active
      ? 'bg-secondary text-link font-semibold'
      : 'text-muted-foreground hover:text-link hover:bg-surface-raised'
    }`

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-2 sm:gap-3 xl:gap-6 px-3 sm:px-6 lg:px-8">
        {/* Brand & Left Navigation */}
        <div className="flex items-center gap-3 xl:gap-6 shrink-0">
          {/* Logo iutruyen */}
          <BrandLogo size="md" />

          {/* Desktop Nav Links */}
          <nav aria-label="Điều hướng khám phá" className="hidden lg:flex items-center gap-1">
            <Link
              to="/stories?sort=hot"
              title="Truyện hot"
              aria-current={isActive('/stories', 'sort=hot') ? 'page' : undefined}
              className={navLinkClass(isActive('/stories', 'sort=hot'))}
            >
              <Flame className="h-4 w-4 text-orange-500" />
              <span>Truyện hot</span>
            </Link>

            {/* Thể loại Dropdown */}
            <div className="relative" ref={genresMenuRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsGenresOpen(false) }}>
              <button
                type="button"
                aria-expanded={isGenresOpen}
                aria-controls="navbar-genres"
                onClick={() => setIsGenresOpen(!isGenresOpen)}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-muted-foreground hover:text-link hover:bg-surface-raised transition-colors cursor-pointer text-sm font-medium"
              >
                <Layers className="h-4 w-4" />
                <span>Thể loại</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
              </button>

              {isGenresOpen && (
                <div id="navbar-genres" className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-3 shadow-card z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="grid grid-cols-2 gap-1.5 max-h-80 overflow-y-auto pr-1">
                    {genres.map((g) => (
                      <button
                        key={g._id}
                        type="button"
                        data-genre-option
                        onClick={() => {
                          setIsGenresOpen(false)
                          navigate(`/stories?genre=${g._id}`)
                        }}
                        className="min-h-11 rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-secondary hover:text-link transition-colors break-words text-left w-full"
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link
              to="/ranking"
              title="Bảng xếp hạng"
              aria-current={isActive('/ranking') ? 'page' : undefined}
              className={navLinkClass(isActive('/ranking'))}
            >
              <Trophy className="h-4 w-4" />
              <span className="hidden xl:inline">Bảng xếp hạng</span>
            </Link>

            <Link
              to="/stories?status=completed"
              title="Truyện full"
              className={navLinkClass(isActive('/stories', 'status=completed'))}
            >
              <BookCheck className="h-4 w-4" />
              <span className="hidden xl:inline">Truyện full</span>
            </Link>

            <Link
              to="/library/history"
              title="Lịch sử đọc"
              className={navLinkClass(isActive('/library/history') || isActive('/history'))}
            >
              <History className="h-4 w-4" />
              <span className="hidden xl:inline">Lịch sử</span>
            </Link>

            {isAuthor && (
              <Link
                to="/author/stories/new"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-link bg-secondary hover:bg-primary/20 transition-colors font-medium text-xs shrink-0"
              >
                <PenTool className="h-3.5 w-3.5" />
                <span>Sáng tác</span>
              </Link>
            )}
          </nav>
        </div>

        {/* Center Search Bar */}
        <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
          <SearchBar className="w-full! max-w-[280px]" />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-0 sm:gap-3 shrink-0">
          {/* Mobile search button */}
          <Link
            to="/search"
            className="flex lg:hidden items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-link hover:bg-secondary transition-colors"
            title="Tìm kiếm"
          >
            <Search className="h-4 w-4" />
          </Link>

          <ThemeToggle />

          {/* Moderation Queue Bell (chỉ khi có role admin/moderator) */}
          {canModerate && <ModerationBadgeBell panelClassName="top-full" />}

          {/* Notifications (chỉ khi logged in) */}
          <NotificationBell panelClassName="top-full" />

          {/* Auth area */}
          {isAuthenticated && user ? (
            <div ref={userMenuRef} className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsUserMenuOpen(false) }}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((o) => !o)}
                aria-expanded={isUserMenuOpen}
                aria-label={`Tài khoản ${user.displayName}`}
                aria-controls="navbar-account"
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border-0 bg-transparent p-1 shadow-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="h-7 w-7 rounded-full bg-secondary text-link flex items-center justify-center font-bold text-xs overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    user.displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <span className="hidden sm:inline text-xs font-semibold text-foreground max-w-[100px] truncate">
                  {user.displayName}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>

              {isUserMenuOpen && (
                <div
                  id="navbar-account"
                  className="absolute right-0 top-full mt-2 w-56 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-card z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="text-xs font-bold text-foreground truncate">{user.displayName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary hover:text-link transition-colors"
                  >
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Hồ sơ cá nhân</span>
                  </Link>

                  <Link
                    to="/profile/library"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary hover:text-link transition-colors"
                  >
                    <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Tủ sách & Dấu trang</span>
                  </Link>

                  {user.role === 'user' && (
                    <Link
                      to={ROUTES.AUTHOR_APPLY}
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-link hover:bg-secondary transition-colors"
                    >
                      <PenTool className="h-3.5 w-3.5" />
                      <span>{user.authorStatus === 'pending' ? 'Đơn đăng ký tác giả' : 'Đăng ký làm tác giả'}</span>
                    </Link>
                  )}

                  {isAuthor && (
                    <Link
                      to="/author/stories"
                      onClick={() => setIsUserMenuOpen(false)}
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
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-link hover:bg-secondary transition-colors"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Kiểm duyệt</span>
                    </Link>
                  )}

                  {user?.role === 'admin' && <Link to="/admin" onClick={() => setIsUserMenuOpen(false)} className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-link hover:bg-secondary"><ShieldCheck className="h-3.5 w-3.5" /><span>Quản trị hệ thống</span></Link>}

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      logout()
                    }}
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
                  <UserPlus className="hidden sm:block h-3.5 w-3.5" />
                  Đăng ký
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
      <MobileStoryNavigation />
    </header>
  )
}

export default Navbar
