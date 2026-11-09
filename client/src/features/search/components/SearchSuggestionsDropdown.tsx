import React, { useEffect, useId, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Search, X, BookOpen, Star, ArrowRight, TrendingUp } from 'lucide-react'
import type { SearchSuggestionsResponse } from '@/types/search'

interface SearchSuggestionsDropdownProps {
  id?: string
  query: string
  suggestionsData?: SearchSuggestionsResponse
  isLoading?: boolean
  selectedIndex: number
  onSelectQuery: (q: string) => void
  onDeleteHistoryItem?: (q: string) => void
  onClose: () => void
  className?: string
}

// Utility to highlight matching query text
export const HighlightText: React.FC<{ text: string; highlight: string }> = ({
  text,
  highlight,
}) => {
  if (!highlight.trim()) {
    return <span>{text}</span>
  }

  const escaped = highlight.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="text-link font-semibold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

export const SearchSuggestionsDropdown: React.FC<SearchSuggestionsDropdownProps> = ({
  id,
  query,
  suggestionsData,
  isLoading,
  selectedIndex,
  onSelectQuery,
  onDeleteHistoryItem,
  onClose,
  className = '',
}) => {
  const navigate = useNavigate()
  const generatedId = useId()
  const dropdownId = id ?? generatedId
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedIndex >= 0) {
      const option = document.getElementById(`${dropdownId}-${selectedIndex}`)
      if (option && dropdownRef.current?.contains(option)) option.scrollIntoView?.({ block: 'nearest' })
    }
  }, [selectedIndex, dropdownId])

  const history = suggestionsData?.history || []
  const suggestions = suggestionsData?.suggestions || []
  const stories = suggestionsData?.stories || []
  const trending = suggestionsData?.trending || []

  const hasHistory = history.length > 0
  const hasSuggestions = suggestions.length > 0
  const hasStories = stories.length > 0
  const hasTrending = !query.trim() && trending.length > 0

  // Flatten items for keyboard navigation tracking
  // 1: history items, 2: suggestions, 3: stories, 4: footer
  let currentIndex = -1

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleStoryClick = (slug: string) => {
    onClose()
    navigate(`/stories/${slug}`)
  }

  return (
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label="Gợi ý tìm kiếm"
      id={dropdownId}
      onMouseDown={(event) => event.preventDefault()}
      className={`absolute left-0 top-full mt-1.5 w-full max-h-[min(460px,60dvh)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card/98 backdrop-blur-md shadow-xl shadow-black/10 z-50 animate-in fade-in-0 zoom-in-95 duration-150 ${className}`}
    >
      {/* Loading state indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Đang tìm kiếm gợi ý...</span>
        </div>
      )}

      {/* SECTION 1: Lịch sử tìm kiếm */}
      {hasHistory && (
        <div className="pt-3 pb-1.5 border-b border-border/50">
          <div className="px-4 pb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <Clock className="h-3 w-3" />
              <span>Lịch sử tìm kiếm</span>
            </div>
          </div>
          <div>
            {history.map((item, idx) => {
              currentIndex++
              const isSelected = selectedIndex === currentIndex
              return (
                <div
                  key={`hist-${idx}`}
                  role="option"
                  id={`${dropdownId}-${currentIndex}`}
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelectQuery(item) } }}
                  aria-selected={isSelected}
                  className={`group flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${isSelected
                    ? 'bg-primary/8 text-link'
                    : 'hover:bg-secondary/60 text-foreground'
                    }`}
                  onClick={() => onSelectQuery(item)}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="h-6 w-6 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-sm truncate">{item}</span>
                  </div>
                  {onDeleteHistoryItem && (
                    <button
                      type="button"
                      title="Xóa khỏi lịch sử"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteHistoryItem(item)
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all ml-2"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: Gợi ý từ khóa (Autocomplete) */}
      {hasSuggestions && (
        <div className="pt-3 pb-1.5 border-b border-border/50">
          <div className="px-4 pb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <Search className="h-3 w-3" />
            <span>Từ khóa gợi ý</span>
          </div>
          <div>
            {suggestions.map((item, idx) => {
              currentIndex++
              const isSelected = selectedIndex === currentIndex
              return (
                <div
                  key={`sug-${idx}`}
                  role="option"
                  id={`${dropdownId}-${currentIndex}`}
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelectQuery(item) } }}
                  aria-selected={isSelected}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isSelected
                    ? 'bg-primary/8 text-link'
                    : 'hover:bg-secondary/60 text-foreground'
                    }`}
                  onClick={() => onSelectQuery(item)}
                >
                  <div className="h-6 w-6 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                    <Search className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span className="text-sm truncate min-w-0 flex-1">
                    <HighlightText text={item} highlight={query} />
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: Truyện phù hợp */}
      {hasStories && (
        <div className="pt-3 pb-2 border-b border-border/50">
          <div className="px-4 pb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <BookOpen className="h-3 w-3" />
            <span>Truyện phù hợp</span>
          </div>
          <div className="px-2">
            {stories.map((story, idx) => {
              currentIndex++
              const isSelected = selectedIndex === currentIndex
              return (
                <div
                  key={`story-${idx}`}
                  role="option"
                  id={`${dropdownId}-${currentIndex}`}
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleStoryClick(story.slug) } }}
                  aria-selected={isSelected}
                  className={`group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${isSelected
                    ? 'bg-primary/8 ring-1 ring-primary/20'
                    : 'hover:bg-secondary/60'
                    }`}
                  onClick={() => handleStoryClick(story.slug)}
                >
                  {/* Thumbnail */}
                  <div className="h-14 w-10 rounded-none bg-muted border border-border/60 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                    {story.coverUrl ? (
                      <img
                        src={story.coverUrl}
                        alt={story.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-link transition-colors">
                      <HighlightText text={story.title} highlight={query} />
                    </h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
                      {story.author?.displayName && (
                        <span className="truncate max-w-[95px]">
                          <HighlightText text={story.author.displayName} highlight={query} />
                        </span>
                      )}
                      {story.genres && story.genres[0] && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="text-link/80 font-medium truncate max-w-[75px]">{story.genres[0].name}</span>
                        </>
                      )}
                      {story.ratingAverage > 0 && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="flex items-center gap-0.5 text-warning font-semibold shrink-0">
                            <Star className="h-2.5 w-2.5 fill-warning" />
                            {story.ratingAverage.toFixed(1)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Arrow hint */}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-150" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: Xu hướng (Trending) khi chưa có query */}
      {hasTrending && (
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            <TrendingUp className="h-3 w-3 text-link" />
            <span>Xu hướng tìm kiếm</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trending.map((trend, idx) => (
              <button
                key={`trend-${idx}`}
                type="button"
                id={`${dropdownId}-${history.length + suggestions.length + stories.length + idx}`}
                role="option"
                aria-selected={selectedIndex === history.length + suggestions.length + stories.length + idx}
                onClick={() => onSelectQuery(trend)}
                className={`min-h-8 px-2.5 py-1 break-words rounded-full text-xs font-medium bg-secondary/80 text-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-150 cursor-pointer border border-border/50 hover:border-primary hover:shadow-sm ${selectedIndex === history.length + suggestions.length + stories.length + idx ? 'ring-2 ring-primary' : ''}`}
              >
                {trend}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty Fallback */}
      {!hasHistory && !hasSuggestions && !hasStories && !hasTrending && !isLoading && (
        <div className="py-10 px-6 text-center">
          <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {query.trim()
              ? <>Không có gợi ý cho <strong>&ldquo;{query}&rdquo;</strong></>
              : 'Nhập tên truyện, tác giả hoặc thể loại để tìm kiếm'
            }
          </p>
        </div>
      )}

      {/* SECTION 5: Footer CTA */}
      {query.trim() && (
        <div
          role="option"
          id={`${dropdownId}-${history.length + suggestions.length + stories.length}`}
          tabIndex={0}
          aria-selected={selectedIndex === history.length + suggestions.length + stories.length}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectQuery(query) } }}
          className="group flex items-center justify-center gap-2 px-4 py-3 border-t border-border/50 bg-secondary/30 hover:bg-primary/8 cursor-pointer transition-colors"
          onClick={() => onSelectQuery(query)}
        >
          <Search className="h-3.5 w-3.5 text-link shrink-0" />
          <span className="min-w-0 break-words text-sm font-medium text-link">
            Tìm &ldquo;{query}&rdquo; trong tất cả truyện
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-link transition-transform duration-150 group-hover:translate-x-0.5" />
        </div>
      )}
    </div>
  )
}
