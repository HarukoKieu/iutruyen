import React from 'react'
import { Filter, RotateCcw, Star, Check } from 'lucide-react'
import { useGenres } from '@/features/stories/hooks/useGenres'
import type { SearchStoriesParams } from '@/types/search'

interface SearchFilterSidebarProps {
  filters: SearchStoriesParams
  onFilterChange: (
    key: keyof SearchStoriesParams,
    value: SearchStoriesParams[keyof SearchStoriesParams]
  ) => void
  onResetFilters: () => void
  totalCount?: number
  className?: string
}

export const SearchFilterSidebar: React.FC<SearchFilterSidebarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  totalCount,
  className = '',
}) => {
  const { data: genres = [], isLoading: isLoadingGenres } = useGenres()

  const statusOptions = [
    { label: 'Tất cả trạng thái', value: undefined },
    { label: 'Đang ra', value: 'ongoing' },
    { label: 'Hoàn thành', value: 'completed' },
    { label: 'Tạm dừng', value: 'hiatus' },
  ]

  const ratingOptions = [
    { label: 'Mọi đánh giá', value: undefined },
    { label: '4.0★ trở lên', value: 4 },
    { label: '4.5★ trở lên', value: 4.5 },
  ]

  const sortOptions = [
    { label: 'Độ liên quan', value: 'relevance' },
    { label: 'Lượt đọc nhiều', value: 'views' },
    { label: 'Đánh giá cao nhất', value: 'rating' },
    { label: 'Mới cập nhật', value: 'newest' },
    { label: 'Số chương nhiều', value: 'chapters' },
  ]

  const hasActiveFilters = Boolean(
    filters.genre ||
      filters.status ||
      filters.rating ||
      (filters.sort && filters.sort !== 'relevance')
  )

  return (
    <aside
      className={`rounded-2xl border border-border bg-card p-5 shadow-card ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border mb-5">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-link" />
          <h3 className="text-sm font-bold text-foreground">Bộ lọc tìm kiếm</h3>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1 text-xs text-link hover:text-link/80 transition-colors font-medium cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Đặt lại</span>
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Sắp xếp */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
            Sắp xếp theo
          </label>
          <div className="space-y-1">
            {sortOptions.map((opt) => {
              const isSelected = (filters.sort || 'relevance') === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onFilterChange('sort', opt.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-secondary text-link font-semibold'
                      : 'text-foreground hover:bg-surface-raised'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-link shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Trạng thái truyện */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
            Trạng thái phát hành
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {statusOptions.map((opt) => {
              const isSelected = filters.status === opt.value
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => onFilterChange('status', opt.value)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer truncate text-center ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-surface-raised text-foreground hover:bg-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Đánh giá tối thiểu */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
            Điểm đánh giá
          </label>
          <div className="space-y-1">
            {ratingOptions.map((opt) => {
              const isSelected = filters.rating === opt.value
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => onFilterChange('rating', opt.value)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-secondary text-link font-semibold'
                      : 'text-foreground hover:bg-surface-raised'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {opt.value ? (
                      <span className="flex items-center text-warning font-medium">
                        <Star className="h-3 w-3 fill-warning mr-1" />
                        {opt.label}
                      </span>
                    ) : (
                      <span>{opt.label}</span>
                    )}
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-link shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Thể loại */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
            Thể loại truyện
          </label>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => onFilterChange('genre', undefined)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                !filters.genre
                  ? 'bg-secondary text-link font-semibold'
                  : 'text-foreground hover:bg-surface-raised'
              }`}
            >
              <span>Tất cả thể loại</span>
              {!filters.genre && <Check className="h-3.5 w-3.5 text-link shrink-0" />}
            </button>
            {isLoadingGenres ? (
              <div className="py-2 text-center text-xs text-muted-foreground">
                Đang tải thể loại...
              </div>
            ) : (
              genres.map((g) => {
                const isSelected = filters.genre === g._id || filters.genre === g.slug
                return (
                  <button
                    key={g._id}
                    type="button"
                    onClick={() => onFilterChange('genre', g._id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-secondary text-link font-semibold'
                        : 'text-foreground hover:bg-surface-raised'
                    }`}
                  >
                    <span className="truncate">{g.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-link shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {totalCount !== undefined && (
        <div className="mt-6 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          Đang hiển thị <span className="font-semibold text-foreground">{totalCount}</span> tác phẩm
        </div>
      )}
    </aside>
  )
}
