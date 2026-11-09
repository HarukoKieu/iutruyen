import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Search, ListOrdered, Check } from 'lucide-react'
import type { ChapterListItem } from '@/types/chapter'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'

interface TableOfContentsDrawerProps {
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  open: boolean
  onClose: () => void
  chapters: ChapterListItem[]
  currentChapterSlug: string
  storySlug: string
  storyTitle: string
}

export const TableOfContentsDrawer: React.FC<TableOfContentsDrawerProps> = ({
  hasMore, loadingMore, onLoadMore,
  open,
  onClose,
  chapters,
  currentChapterSlug,
  storySlug,
  storyTitle,
}) => {
  const [search, setSearch] = useState('')
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  useModalAccessibility({ open, onClose, containerRef: dialogRef })

  if (!open) return null

  const filtered = chapters.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.order.toString().includes(search)
  )

  return (
    <div className="fixed inset-0 z-[80] flex">
      {/* Backdrop */}
      <div
        data-modal-backdrop
        aria-hidden="true"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Content */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 flex h-dvh w-full max-w-md min-w-0 flex-col bg-card border-r border-border shadow-2xl animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-link">
              <ListOrdered className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="font-serif text-base font-bold text-foreground">Mục Lục Chương</h2>
              <p className="text-xs text-muted-foreground truncate">{storyTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng mục lục"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search filter - Pill Shaped */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              aria-label="Tìm trong chương đã tải"
              placeholder="Tìm trong chương đã tải: Tìm theo số chương, tựa đề..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-border bg-surface-base pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring shadow-xs"
            />
          </div>
        </div>

        {/* Chapter List - No rounded corners, explicit "Chương X: Tiêu đề" */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-border-subtle">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Không tìm thấy chương phù hợp.
            </div>
          ) : (
            filtered.map((chap) => {
              const isActive = chap.slug === currentChapterSlug
              return (
                <Link
                  key={chap._id}
                  to={`/stories/${storySlug}/chapters/chuong-${chap.order}`}
                  onClick={onClose}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center justify-between px-4 py-3 text-xs transition-colors rounded-none ${
                    isActive
                      ? 'bg-secondary text-link font-bold shadow-xs'
                      : 'text-foreground hover:bg-surface-raised'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">
                      Chương {chap.order}: {chap.title}
                    </span>
                  </div>
                  {isActive && <Check className="h-4 w-4 shrink-0 text-link ml-2" />}
                </Link>
              )
            })
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-border p-3 text-center text-[11px] text-muted-foreground bg-surface-raised/40">
          {hasMore && <button type="button" disabled={loadingMore} onClick={onLoadMore} className="mb-2 block w-full text-link">{loadingMore ? 'Đang tải…' : 'Tải thêm chương'}</button>}
          Đã tải <strong className="text-foreground">{chapters.length}</strong> chương
        </div>
      </div>
    </div>
  )
}

export default TableOfContentsDrawer
