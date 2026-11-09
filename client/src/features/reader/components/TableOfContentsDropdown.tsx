import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ListOrdered, Search, X } from 'lucide-react'
import type { ChapterListItem } from '@/types/chapter'

interface TableOfContentsDropdownProps {
  chapters: ChapterListItem[]
  currentChapterId: string
  storySlug: string
  hasMore?: boolean
  loading?: boolean
  error?: boolean
  loadingMore?: boolean
  placement?: 'top' | 'bottom'
  onLoadMore: () => void
  onRetry: () => void
  searchQuery?: string
  onSearch?: (query: string) => void
}

export function TableOfContentsDropdown({
  chapters, currentChapterId, storySlug, hasMore, loading, error, loadingMore,
  onLoadMore, onRetry, placement = 'top', searchQuery, onSearch,
}: TableOfContentsDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus({ preventScroll: true })
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const query = (searchQuery ?? search).trim().toLocaleLowerCase('vi')
  const filtered = onSearch ? chapters : chapters.filter(chapter =>
    chapter.title.toLocaleLowerCase('vi').includes(query) || String(chapter.order).includes(query)
  )

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        title="Mục lục"
        aria-label="Mục lục"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen(value => !value)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border-0 bg-card text-foreground shadow-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ListOrdered className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Danh sách chương"
          className={`absolute left-[calc(50%+1.5rem)] sm:left-1/2 z-40 flex max-h-[min(60vh,28rem)] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-card ${placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'}`}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Danh sách chương</h2>
            <button type="button" aria-label="Đóng mục lục" onClick={() => { setOpen(false); buttonRef.current?.focus() }} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-raised cursor-pointer">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="relative shrink-0 border-b border-border p-3">
            <Search className="absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input ref={searchRef} type="search" aria-label={onSearch ? 'Tìm trong toàn bộ mục lục' : 'Tìm trong chương đã tải'} placeholder="Tìm số chương hoặc tiêu đề…" value={searchQuery ?? search} onChange={event => onSearch ? onSearch(event.target.value) : setSearch(event.target.value)} className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus-visible:ring-ring" />
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {loading ? <p role="status" className="p-4 text-center text-xs text-muted-foreground">Đang tải chương…</p> : (
              <ul className="divide-y divide-border-subtle">
                {filtered.map(chapter => {
                  const current = chapter._id === currentChapterId
                  const title = /^chương\s+\d+/i.test(chapter.title.trim()) ? chapter.title : `Chương ${chapter.order}: ${chapter.title}`
                  return (
                    <li key={chapter._id}>
                      <Link to={`/stories/${storySlug}/chapters/chuong-${chapter.order}`} aria-current={current ? 'page' : undefined} onClick={() => setOpen(false)} className={`flex items-center justify-between gap-3 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${current ? 'bg-secondary font-semibold text-link' : 'hover:bg-surface-raised'}`}>
                        <span className="min-w-0 break-words">{title}</span>
                        {current && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      </Link>
                    </li>
                  )
                })}
                {!filtered.length && !error && <li className="p-4 text-center text-xs text-muted-foreground">{chapters.length ? 'Không tìm thấy chương phù hợp.' : 'Chưa có chương.'}</li>}
              </ul>
            )}
          </div>
          <div className="shrink-0 border-t border-border p-3 text-center text-xs text-muted-foreground">
            {error && <p role="alert" className="mb-2">Không thể tải danh sách chương. <button type="button" onClick={onRetry} className="text-link cursor-pointer">Thử lại</button></p>}
            {hasMore && <button type="button" disabled={loadingMore} onClick={onLoadMore} className="mb-2 block w-full text-link disabled:opacity-50 cursor-pointer">{loadingMore ? 'Đang tải…' : 'Tải thêm chương'}</button>}
            Đã tải {chapters.length} chương
          </div>
        </div>
      )}
    </div>
  )
}
