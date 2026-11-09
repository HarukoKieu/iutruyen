import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronRight } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { StoryGrid } from '../components/StoryGrid'
import { StoryFilters } from '../components/StoryFilters'
import { useStories } from '../hooks/useStories'
import { useGenres } from '../hooks/useGenres'
import type { StorySortOption, StoryStatus } from '@/types/story'
import { Button } from '@/components/ui/button'

export const StoryListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  // Đọc trực tiếp từ URL — luôn đồng bộ khi URL thay đổi từ bất kỳ đâu
  const selectedGenre = searchParams.get('genre') || ''
  const selectedSort = (searchParams.get('sort') as StorySortOption) || 'new'
  const selectedStatus = searchParams.get('status') || ''
  const activeSearch = searchParams.get('q') || ''
  const rawAuthor = searchParams.get('author') || ''
  const selectedAuthor = rawAuthor && rawAuthor !== 'undefined' ? rawAuthor : ''

  // searchQuery chỉ dùng cho input chưa submit
  const [searchQuery, setSearchQuery] = useState(activeSearch)

  // Sync input khi activeSearch thay đổi từ URL bên ngoài
  useEffect(() => {
    setSearchQuery(activeSearch)
  }, [activeSearch])

  const { data: genres = [] } = useGenres()

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    refetch,
  } = useStories({
    genre: selectedGenre || undefined,
    sort: selectedSort,
    status: (selectedStatus as StoryStatus) || undefined,
    q: activeSearch || undefined,
    author: selectedAuthor || undefined,
    limit: 24,
  })

  const stories = data?.pages.flatMap((page) => page.stories) ?? []
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => observerRef.current?.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Helpers để cập nhật từng param riêng lẻ
  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      // Reset sort về 'new' nếu default để URL sạch
      if (key === 'sort' && value === 'new') params.delete('sort')
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const handleGenreChange = useCallback(
    (genre: string) => updateParam('genre', genre),
    [updateParam]
  )

  const handleSortChange = useCallback(
    (sort: StorySortOption) => updateParam('sort', sort),
    [updateParam]
  )

  const handleStatusChange = useCallback(
    (status: string) => updateParam('status', status),
    [updateParam]
  )

  const handleSearchSubmit = useCallback(() => {
    updateParam('q', searchQuery)
  }, [searchQuery, updateParam])

  const activeGenreName = genres.find((g) => g._id === selectedGenre)?.name
  const listTitle = activeGenreName ? `Truyện ${activeGenreName}` : selectedStatus === 'completed' ? 'Truyện hoàn thành' : selectedSort === 'hot' ? 'Truyện nổi bật' : selectedSort === 'rating' ? 'Truyện đánh giá cao' : selectedSort === 'top-week' ? 'Top lượt đọc tích lũy' : selectedSort === 'top-month' ? 'Top theo dõi tích lũy' : 'Khám phá truyện'

  return (
    <AppLayout showAds>
      {/* Page Header */}
      <div className="border-b border-border-subtle bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-link transition-colors">
              Trang chủ
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">Khám phá truyện</span>
            {activeGenreName && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="font-medium text-link">{activeGenreName}</span>
              </>
            )}
          </div>
          <h1 className="break-words font-serif text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            {activeGenreName && <BookOpen className="h-8 w-8 text-link" />}
            {listTitle}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Tìm kiếm và khám phá kho truyện chữ phong phú, đa dạng thể loại.
            {!isLoading && stories.length > 0 && (
              <span className="ml-1 font-medium text-foreground">
                ({stories.length}+ tác phẩm)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <StoryFilters
            selectedGenre={selectedGenre}
            onGenreChange={handleGenreChange}
            selectedSort={selectedSort}
            onSortChange={handleSortChange}
            selectedStatus={selectedStatus}
            onStatusChange={handleStatusChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={handleSearchSubmit}
          />

          <div className="flex-1 min-w-0">
            {isError ? <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-6 text-center"><p>Không thể tải danh sách truyện.</p><Button variant="outline" onClick={() => { void refetch() }} className="mt-3">Thử lại</Button></div> : <StoryGrid stories={stories} isLoading={isLoading || isFetchingNextPage} />}

            <div ref={loadMoreRef} className="h-4" />

            {hasNextPage && isFetchingNextPage && (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}

            {hasNextPage && !isFetchingNextPage && <div className="py-4 text-center"><Button variant="outline" onClick={() => { void fetchNextPage() }}>Tải thêm truyện</Button></div>}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default StoryListPage
