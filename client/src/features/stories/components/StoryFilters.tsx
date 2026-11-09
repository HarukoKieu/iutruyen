import React from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useGenres } from '../hooks/useGenres'
import type { StorySortOption } from '@/types/story'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'

interface StoryFiltersProps {
  selectedGenre: string
  onGenreChange: (genre: string) => void
  selectedSort: StorySortOption
  onSortChange: (sort: StorySortOption) => void
  selectedStatus: string
  onStatusChange: (status: string) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  onSearchSubmit: () => void
}

const SORT_OPTIONS: { value: StorySortOption; label: string }[] = [
  { value: 'new', label: 'Mới nhất' },
  { value: 'hot', label: 'Nổi bật' },
  { value: 'top-week', label: 'Lượt đọc tích lũy' },
  { value: 'top-month', label: 'Lượt theo dõi tích lũy' },
  { value: 'rating', label: 'Đánh giá cao' },
  { value: 'chapters', label: 'Nhiều chương' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'ongoing', label: 'Đang ra' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'hiatus', label: 'Tạm dừng' },
]

export const StoryFilters: React.FC<StoryFiltersProps> = ({
  selectedGenre,
  onGenreChange,
  selectedSort,
  onSortChange,
  selectedStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
}) => {
  const { data: genres = [] } = useGenres()
  const [isMobileFilterOpen, setIsMobileFilterOpen] = React.useState(false)
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  useModalAccessibility({ open: isMobileFilterOpen, onClose: () => setIsMobileFilterOpen(false), containerRef: dialogRef })

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSearchSubmit()
  }

  const filterContent = (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          aria-label="Tìm truyện trong danh sách"
          placeholder="Tìm truyện..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="w-full rounded-full border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring transition-all"
        />
      </div>

      {/* Sort */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Sắp xếp
        </label>
        <Select aria-label="Sắp xếp truyện" value={selectedSort} onChange={(e) => onSortChange(e.target.value as StorySortOption)}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Status */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Trạng thái
        </label>
        <Select aria-label="Trạng thái truyện" value={selectedStatus} onChange={(e) => onStatusChange(e.target.value)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Genres */}
      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Thể loại
        </label>
        <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
          <button type="button" aria-pressed={selectedGenre === ''} onClick={() => onGenreChange('')} className="min-h-8 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"><Badge variant={selectedGenre === '' ? 'default' : 'outline'}>Tất cả</Badge></button>
          {genres.map((g) => (
            <button key={g._id} type="button" aria-pressed={selectedGenre === g._id} onClick={() => onGenreChange(g._id)} className="max-w-full min-h-8 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"><Badge variant={selectedGenre === g._id ? 'default' : 'outline'} className="max-w-full break-words">{g.name}</Badge></button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Bộ lọc
          </h3>
          {filterContent}
        </div>
      </aside>

      {/* Mobile Filter Button */}
      <div className="lg:hidden mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            aria-label="Tìm truyện trong danh sách"
            placeholder="Tìm truyện..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full rounded-full border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>
        <Button
          variant="outline"
          className="rounded-full shrink-0"
          onClick={() => setIsMobileFilterOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isMobileFilterOpen}
        >
          <SlidersHorizontal className="h-4 w-4 mr-1" />
          Lọc
        </Button>
      </div>

      {/* Mobile Filter Sheet (bottom) */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div
            data-modal-backdrop
            aria-hidden="true"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileFilterOpen(false)}
          />
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed bottom-0 left-0 right-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom">
            <div className="mb-4 flex items-center justify-between">
              <h2 id={titleId} className="text-sm font-semibold text-foreground flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Bộ lọc
              </h2>
              <button
                type="button"
                aria-label="Đóng bộ lọc"
                onClick={() => setIsMobileFilterOpen(false)}
                className="rounded-full p-1 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {filterContent}
            <Button
              className="mt-5 w-full rounded-full"
              onClick={() => setIsMobileFilterOpen(false)}
            >
              Áp dụng
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

export default StoryFilters
