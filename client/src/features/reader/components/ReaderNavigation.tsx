import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Flame, Layers, ChevronDown, Trophy, BookCheck, History, PenTool, Menu } from 'lucide-react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useGenres } from '@/features/stories/hooks/useGenres'

export function ReaderNavigation() {
  const { user } = useAuthStore()
  const { data: genres = [] } = useGenres()
  const navigate = useNavigate()
  const location = useLocation()
  const [isGenresOpen, setIsGenresOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const navigationRef = useRef<HTMLElement>(null)
  const genresMenuRef = useRef<HTMLDivElement>(null)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const isAuthor = user?.role === 'author' || user?.role === 'admin'

  const closeMenus = () => {
    setIsGenresOpen(false)
    setIsMobileMenuOpen(false)
  }

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (!navigationRef.current?.contains(target)) {
        setIsMobileMenuOpen(false)
        setIsGenresOpen(false)
      } else if (!genresMenuRef.current?.contains(target)) {
        setIsGenresOpen(false)
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsGenresOpen(false)
      setIsMobileMenuOpen(false)
      if (isMobileMenuOpen) mobileTriggerRef.current?.focus()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [isMobileMenuOpen])

  const isActive = (path: string, search?: string) => location.pathname === path && (!search || location.search.includes(search))
  const navLinkClass = (active: boolean) =>
    `flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors md:w-auto md:rounded-full md:px-2 md:py-1.5 2xl:px-3 ${active ? 'bg-secondary text-link font-semibold' : 'text-muted-foreground hover:text-link hover:bg-surface-raised'}`

  return (
    <nav ref={navigationRef} aria-label="Điều hướng trang đọc" className="relative min-w-0 shrink-0">
      <button
        ref={mobileTriggerRef}
        type="button"
        aria-expanded={isMobileMenuOpen}
        aria-controls={menuId}
        onClick={() => setIsMobileMenuOpen(open => !open)}
        className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer md:hidden"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
        Điều hướng
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <div id={menuId} className={`${isMobileMenuOpen ? 'flex' : 'hidden'} absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-8rem)] w-72 max-w-[calc(100vw-1.5rem)] flex-col gap-1 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-card md:static md:mt-0 md:flex md:max-h-none md:w-auto md:max-w-none md:flex-row md:items-center md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
        <Link to="/stories?sort=hot" title="Truyện hot" aria-label="Truyện hot" onClick={closeMenus} className={navLinkClass(isActive('/stories', 'sort=hot'))}>
          <Flame className="h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />
          <span>Truyện hot</span>
        </Link>

        <div className="relative w-full md:w-auto" ref={genresMenuRef}>
          <button
            type="button"
            aria-expanded={isGenresOpen}
            onClick={() => setIsGenresOpen(open => !open)}
            className={`${navLinkClass(false)} cursor-pointer`}
          >
            <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Thể loại</span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60 md:ml-0.5" aria-hidden="true" />
          </button>

          {isGenresOpen && (
            <div className="mt-2 w-full rounded-xl border border-border bg-card p-2 md:absolute md:left-0 md:top-full md:z-50 md:w-80 md:rounded-2xl md:p-3 md:shadow-card">
              <div className="grid max-h-80 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
                {genres.map(genre => (
                  <button
                    key={genre._id}
                    type="button"
                    onClick={() => {
                      closeMenus()
                      navigate(`/stories?genre=${genre._id}`)
                    }}
                    className="w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-foreground hover:bg-secondary hover:text-link transition-colors cursor-pointer"
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Link to="/ranking" title="Bảng xếp hạng" aria-label="Bảng xếp hạng" onClick={closeMenus} className={navLinkClass(isActive('/ranking'))}>
          <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="md:hidden lg:inline">Bảng xếp hạng</span>
        </Link>
        <Link to="/stories?status=completed" title="Truyện full" aria-label="Truyện full" onClick={closeMenus} className={navLinkClass(isActive('/stories', 'status=completed'))}>
          <BookCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="md:hidden lg:inline">Truyện full</span>
        </Link>
        <Link to="/library/history" title="Lịch sử đọc" aria-label="Lịch sử đọc" onClick={closeMenus} className={navLinkClass(isActive('/library/history') || isActive('/history'))}>
          <History className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="md:hidden lg:inline">Lịch sử</span>
        </Link>
        {isAuthor && (
          <Link to="/author/stories/new" title="Sáng tác" onClick={closeMenus} className="flex w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-link hover:bg-primary/20 transition-colors md:w-auto md:rounded-full md:px-2 md:py-1.5 2xl:px-3">
            <PenTool className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sáng tác</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
