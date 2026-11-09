import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  Search,
  X,
  Clock,
  TrendingUp,
  SlidersHorizontal,
  AlertCircle,
  ChevronDown,
  Layers,
} from 'lucide-react'
import {
  useSearchStories,
  useSearchSuggestions,
  useSearchHistory,
  useDeleteSearchHistory,
} from '../hooks/useSearch'
import { SearchFilterSidebar } from '../components/SearchFilterSidebar'
import { SearchSuggestionsDropdown } from '../components/SearchSuggestionsDropdown'
import { StoryCard } from '@/features/stories/components/StoryCard'
import { useGenres } from '@/features/stories/hooks/useGenres'
import { useAuthStore } from '@/features/auth/store/authStore'
import { Button } from '@/components/ui/button'
import type { SearchStoriesParams } from '@/types/search'
import AdSlot from '@/components/common/AdSlot'

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  const urlQuery = searchParams.get('q') || ''
  const urlGenre = searchParams.get('genre') || undefined
  const urlStatus = (searchParams.get('status') as SearchStoriesParams['status']) || undefined
  const urlRating = searchParams.get('rating') ? Number(searchParams.get('rating')) : undefined
  const urlSort = (searchParams.get('sort') as SearchStoriesParams['sort']) || 'relevance'

  const [searchInput, setSearchInput] = useState(urlQuery)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!searchBoxRef.current?.contains(event.target as Node)) setIsDropdownOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  // Sync state if url changes
  useEffect(() => {
    setSearchInput(urlQuery)
  }, [urlQuery])

  // Filters state
  const currentFilters: SearchStoriesParams = useMemo(
    () => ({
      q: urlQuery.trim() || undefined,
      genre: urlGenre,
      status: urlStatus,
      rating: urlRating,
      sort: urlSort,
      limit: 20,
    }),
    [urlQuery, urlGenre, urlStatus, urlRating, urlSort]
  )

  // API Queries
  const {
    data: storiesData,
    isLoading: isLoadingStories,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    refetch,
  } = useSearchStories(currentFilters)

  const { data: suggestionsData, isLoading: isLoadingSuggestions } = useSearchSuggestions(
    searchInput,
    isDropdownOpen
  )

  const { data: searchHistory = [] } = useSearchHistory()
  const { mutate: deleteSearchHistory } = useDeleteSearchHistory()
  const { data: genres = [] } = useGenres()

  // Flatten stories across infinite pages
  const allStories = useMemo(() => {
    return storiesData?.pages.flatMap((page) => page.stories) || []
  }, [storiesData])

  const totalLoaded = allStories.length

  // Filter updates
  const handleFilterChange = (
    key: keyof SearchStoriesParams,
    value: SearchStoriesParams[keyof SearchStoriesParams]
  ) => {
    const nextParams = new URLSearchParams(searchParams)
    if (value !== undefined && value !== null && value !== '') {
      nextParams.set(key, String(value))
    } else {
      nextParams.delete(key)
    }
    if (key === 'sort' && value === 'relevance') {
      nextParams.delete('sort')
    }
    setSearchParams(nextParams)
  }

  const handleResetFilters = () => {
    const nextParams = new URLSearchParams()
    if (urlQuery) nextParams.set('q', urlQuery)
    setSearchParams(nextParams)
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsDropdownOpen(false)
    const trimmed = searchInput.trim()
    const nextParams = new URLSearchParams(searchParams)
    if (trimmed) {
      nextParams.set('q', trimmed)
    } else {
      nextParams.delete('q')
    }
    setSearchParams(nextParams)
  }

  const handleSelectQuery = (query: string) => {
    setSearchInput(query)
    setIsDropdownOpen(false)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('q', query)
    setSearchParams(nextParams)
  }

  const handleDeleteHistoryItem = (query: string) => {
    deleteSearchHistory(query)
  }

  const handleClearAllHistory = () => {
    deleteSearchHistory(undefined)
  }

  const trendingTags = suggestionsData?.trending?.length
    ? suggestionsData.trending
    : ['Tiên Hiệp', 'Huyền Huyễn', 'Đô Thị', 'Võng Du', 'Ngôn Tình', 'Khoa Huyễn']

  const hasSearchQuery = Boolean(urlQuery.trim() || urlGenre || urlStatus || urlRating || urlSort !== 'relevance')

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* PAGE HEADER & HERO SEARCH */}
      <section className="border-b border-border bg-gradient-to-b from-secondary/30 via-background to-background py-10 sm:py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight">
              Tìm kiếm truyện
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
              Khám phá hàng ngàn tác phẩm đặc sắc theo tên truyện, tác giả hoặc thể loại yêu thích.
            </p>
          </div>

          {/* Search Input Box */}
          <div ref={searchBoxRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDropdownOpen(false) }} className="relative max-w-3xl mx-auto">
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-5 h-5 w-5 text-muted-foreground pointer-events-none transition-colors" />
                <input
                  type="text"
                  aria-label="Tìm kiếm truyện, tác giả hoặc thể loại"
                  placeholder="Tìm truyện, tác giả, thể loại..."
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value)
                    setIsDropdownOpen(true)
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="w-full h-14 pl-14 pr-24 rounded-2xl border-2 border-border bg-card text-base font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring shadow-sm transition-all"
                />

                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                      const next = new URLSearchParams(searchParams)
                      next.delete('q')
                      setSearchParams(next)
                    }}
                    className="absolute right-14 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                    title="Xóa từ khóa"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                <Button
                  type="submit"
                  size="sm"
                  className="absolute right-2.5 h-9 px-4 rounded-xl font-semibold"
                >
                  Tìm
                </Button>
              </div>
            </form>

            {/* Suggestions Dropdown */}
            {isDropdownOpen && (
              <SearchSuggestionsDropdown
                query={searchInput}
                suggestionsData={suggestionsData}
                isLoading={isLoadingSuggestions}
                selectedIndex={-1}
                onSelectQuery={handleSelectQuery}
                onDeleteHistoryItem={handleDeleteHistoryItem}
                onClose={() => setIsDropdownOpen(false)}
                className="w-full max-w-none top-full"
              />
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        <AdSlot placement="site-banner" className="mb-8" />
        {/* ========================================================= */}
        {/* CASE A: TRẠNG THÁI DEFAULT (KHI CHƯA CÓ QUERY TÌM KIẾM) */}
        {/* ========================================================= */}
        {!hasSearchQuery && (
          <div className="space-y-12 max-w-5xl mx-auto">
            {/* 1. Lịch sử tìm kiếm (chỉ hiện khi đã đăng nhập và có history) */}
            {isAuthenticated && searchHistory.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-link" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Lịch sử tìm kiếm gần đây
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAllHistory}
                    className="text-xs font-medium text-destructive hover:underline cursor-pointer"
                  >
                    Xóa tất cả
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((item) => (
                    <div
                      key={item._id}
                      className="group flex max-w-full items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-foreground hover:border-primary/40 border border-border transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectQuery(item.query)}
                        className="min-w-0 break-words text-left cursor-pointer hover:text-link transition-colors"
                      >
                        {item.query}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteHistoryItem(item.query)
                        }}
                        className="p-0.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-0.5"
                        title="Xóa"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 2. Từ khóa thịnh hành (Trending) */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-border/60 mb-4">
                <TrendingUp className="h-4 w-4 text-link" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Xu hướng tìm kiếm nổi bật
                </h2>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {trendingTags.map((trend, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectQuery(trend)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-secondary/80 text-foreground hover:bg-primary/20 hover:text-link hover:border-primary/50 border border-border transition-all cursor-pointer shadow-xs"
                  >
                    #{trend}
                  </button>
                ))}
              </div>
            </section>

            {/* 3. Thể loại phổ biến */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-link" />
                  <h2 className="text-base font-bold text-foreground">
                    Khám phá theo thể loại
                  </h2>
                </div>
                <Link
                  to="/stories"
                  className="text-xs font-semibold text-link hover:underline"
                >
                  Xem tất cả →
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {genres.slice(0, 8).map((genre) => (
                  <Link
                    key={genre._id}
                    to={`/stories?genre=${genre._id}`}
                    className="group flex flex-col p-4 rounded-2xl border border-border bg-card hover:bg-secondary/40 hover:border-primary/40 hover:shadow-card transition-all"
                  >
                    <span className="text-sm font-bold text-foreground group-hover:text-link transition-colors">
                      {genre.name}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {genre.description || 'Truyện hay tuyển chọn'}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ========================================================= */}
        {/* CASE B: TRẠNG THÁI KẾT QUẢ TÌM KIẾM (CÓ QUERY HOẶC LỌC) */}
        {/* ========================================================= */}
        {hasSearchQuery && (
          <div>
            {/* Header kết quả */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-6">
              <div>
                <h2 className="break-words text-xl sm:text-2xl font-bold text-foreground">
                  {urlQuery.trim() ? <>Kết quả tìm kiếm cho &ldquo;<span className="text-link font-extrabold">{urlQuery}</span>&rdquo;</> : 'Truyện phù hợp với bộ lọc'}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Đã tải <span className="font-semibold text-foreground">{totalLoaded}</span>{' '}
                  tác phẩm phù hợp
                </p>
              </div>

              {/* Nút bật filter trên Mobile */}
              <div className="flex items-center gap-2 lg:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                  aria-expanded={isMobileFilterOpen}
                  aria-controls="search-mobile-filters"
                  className="w-full flex items-center justify-center gap-2 rounded-xl"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Bộ lọc tìm kiếm</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isMobileFilterOpen ? 'rotate-180' : ''
                      }`}
                  />
                </Button>
              </div>
            </div>

            {/* Mobile Filter Collapsible */}
            {isMobileFilterOpen && (
              <div id="search-mobile-filters" className="mb-6 lg:hidden">
                <SearchFilterSidebar
                  filters={currentFilters}
                  onFilterChange={handleFilterChange}
                  onResetFilters={handleResetFilters}
                  totalCount={totalLoaded}
                />
              </div>
            )}

            {/* Layout 2 cột: Sidebar + Story Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)] gap-6 xl:gap-8 items-start">
              {/* Desktop Filter Sidebar */}
              <div className="hidden lg:block sticky top-20">
                <SearchFilterSidebar
                  filters={currentFilters}
                  onFilterChange={handleFilterChange}
                  onResetFilters={handleResetFilters}
                  totalCount={totalLoaded}
                />
              </div>

              {/* Main Content Area */}
              <div className="min-w-0">
                {/* 1. Loading State */}
                {isLoadingStories && (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-border bg-card p-3 shadow-xs space-y-3 animate-pulse"
                      >
                        <div className="aspect-[3/4] w-full rounded-xl bg-surface-raised" />
                        <div className="h-4 bg-surface-raised rounded w-3/4" />
                        <div className="h-3 bg-surface-raised rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. Error State */}
                {isError && (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
                    <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                    <h3 className="text-base font-bold text-foreground">
                      Không thể tải kết quả tìm kiếm
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Đã có lỗi xảy ra trong quá trình truy vấn dữ liệu. Vui lòng thử lại sau.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { void refetch() }}
                      className="mt-4 rounded-xl"
                    >
                      Thử lại
                    </Button>
                  </div>
                )}

                {/* 3. Empty State */}
                {!isLoadingStories && !isError && allStories.length === 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5 sm:p-12 text-center shadow-card">
                    <div className="h-16 w-16 rounded-full bg-secondary text-link flex items-center justify-center mx-auto mb-4">
                      <Search className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">
                      Không tìm thấy kết quả nào cho &ldquo;{urlQuery}&rdquo;
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
                      Hãy thử kiểm tra lại chính tả, tìm bằng từ khóa chung hơn hoặc bỏ bớt các
                      tiêu chí lọc.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="rounded-xl"
                      >
                        Xóa bộ lọc
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => navigate('/stories')}
                        className="rounded-xl"
                      >
                        Xem tất cả truyện
                      </Button>
                    </div>
                  </div>
                )}

                {/* 4. Story Grid */}
                {!isLoadingStories && allStories.length > 0 && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
                      {allStories.map((story) => (
                        <StoryCard key={story._id} story={story} />
                      ))}
                    </div>

                    {/* Pagination / Load More Button */}
                    {hasNextPage && (
                      <div className="pt-4 text-center">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => fetchNextPage()}
                          disabled={isFetchingNextPage}
                          className="px-8 rounded-full border-primary/30 hover:border-primary text-link font-semibold shadow-xs"
                        >
                          {isFetchingNextPage ? (
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              <span>Đang tải thêm...</span>
                            </div>
                          ) : (
                            <span>Tải thêm truyện</span>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default SearchPage
