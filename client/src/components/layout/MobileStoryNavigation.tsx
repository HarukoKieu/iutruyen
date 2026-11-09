import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookCheck, Flame, Layers, Trophy, X } from 'lucide-react'
import { useGenres } from '@/features/stories/hooks/useGenres'

export function MobileStoryNavigation() {
  const { pathname, search } = useLocation()
  const params = new URLSearchParams(search)
  const { data: genres = [], isLoading, isError, refetch } = useGenres()
  const [genresOpen, setGenresOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const isStoryList = pathname === '/stories'

  useEffect(() => {
    if (!genresOpen) return
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true })
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setGenresOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setGenresOpen(false)
      triggerRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [genresOpen])

  const itemClass = (active: boolean) =>
    `flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[360px]:text-[11px] sm:text-xs ${active ? 'bg-secondary text-link font-semibold' : 'text-muted-foreground hover:bg-surface-raised hover:text-link'}`
  const hotActive = isStoryList && params.get('sort') === 'hot'
  const rankingActive = pathname === '/ranking'
  const fullActive = isStoryList && params.get('status') === 'completed'

  return (
    <nav ref={rootRef} aria-label="Điều hướng truyện trên di động" className="relative border-t border-border/60 px-3 py-2 sm:px-6 lg:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1">
        <Link to="/stories?sort=hot" aria-current={hotActive ? 'page' : undefined} onClick={() => setGenresOpen(false)} className={itemClass(hotActive)}>
          <Flame className="h-5 w-5 text-orange-500" aria-hidden="true" />
          <span className="whitespace-nowrap">Truyện hot</span>
        </Link>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={genresOpen}
          aria-controls={genresOpen ? panelId : undefined}
          onClick={() => setGenresOpen(open => !open)}
          className={`${itemClass(genresOpen || (isStoryList && params.has('genre')))} cursor-pointer`}
        >
          <Layers className="h-5 w-5 text-link" aria-hidden="true" />
          <span className="whitespace-nowrap">Thể loại</span>
        </button>
        <Link to="/ranking" aria-current={rankingActive ? 'page' : undefined} onClick={() => setGenresOpen(false)} className={itemClass(rankingActive)}>
          <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
          <span className="whitespace-nowrap">Bảng xếp hạng</span>
        </Link>
        <Link to="/stories?status=completed" aria-current={fullActive ? 'page' : undefined} onClick={() => setGenresOpen(false)} className={itemClass(fullActive)}>
          <BookCheck className="h-5 w-5 text-link" aria-hidden="true" />
          <span className="whitespace-nowrap">Truyện full</span>
        </Link>
      </div>

      {genresOpen && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Chọn thể loại"
          className="absolute inset-x-3 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-card sm:inset-x-6 sm:mx-auto sm:max-w-2xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Thể loại truyện</h2>
            <button type="button" aria-label="Đóng thể loại" onClick={() => { setGenresOpen(false); triggerRef.current?.focus({ preventScroll: true }) }} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="max-h-[min(55dvh,24rem)] overflow-y-auto overscroll-contain p-3">
            {isLoading ? <p role="status" className="p-3 text-center text-sm text-muted-foreground">Đang tải thể loại…</p>
              : isError ? <p role="alert" className="p-3 text-center text-sm text-muted-foreground">Không tải được thể loại. <button type="button" onClick={() => { void refetch() }} className="text-link underline cursor-pointer">Thử lại</button></p>
              : genres.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {genres.map(genre => (
                  <Link key={genre._id} to={`/stories?genre=${genre._id}`} onClick={() => setGenresOpen(false)} className="flex min-h-11 items-center rounded-lg bg-surface-raised px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {genre.name}
                  </Link>
                ))}
              </div>
                : <p className="p-3 text-center text-sm text-muted-foreground">Chưa có thể loại.</p>}
          </div>
        </div>
      )}
    </nav>
  )
}
