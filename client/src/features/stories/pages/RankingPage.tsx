import React, { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { useRanking } from '../hooks/useRanking'
import { useGenres } from '../hooks/useGenres'
import { useSeoHead } from '@/hooks/useSeoHead'
import { RankingHero } from '../components/ranking/RankingHero'
import { RankingPodium } from '../components/ranking/RankingPodium'
import { RankingListItem } from '../components/ranking/RankingListItem'
import { RankingSkeleton } from '../components/ranking/RankingSkeleton'
import { RankingEmptyState } from '../components/ranking/RankingEmptyState'
import type { RankingMetric } from '@/types/ranking'

export const RankingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const rawMetric = searchParams.get('metric')
  const metric: RankingMetric =
    rawMetric === 'follows' || rawMetric === 'rating' || rawMetric === 'chapters'
      ? rawMetric
      : 'views'

  const selectedGenre = searchParams.get('genre') || ''
  const period = 'all'

  const { data: genres = [] } = useGenres()

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    refetch,
  } = useRanking({
    metric,
    period,
    genre: selectedGenre || undefined,
    limit: 20,
  })

  const stories = useMemo(() => {
    return data?.pages.flatMap((page) => page.stories) ?? []
  }, [data])

  const activeGenre = genres.find(
    (g) => g._id === selectedGenre || g.slug === selectedGenre
  )

  // Dynamic SEO management
  const metricSeoLabel = useMemo(() => {
    switch (metric) {
      case 'follows':
        return 'Được Theo Dõi Nhiều Nhất'
      case 'rating':
        return 'Đánh Giá Cao Nhất'
      case 'chapters':
        return 'Quy Mô Chương Đồ Sộ'
      case 'views':
      default:
        return 'Đọc Nhiều Nhất'
    }
  }, [metric])

  const seoTitle = activeGenre
    ? `Bảng Xếp Hạng Truyện ${metricSeoLabel} — ${activeGenre.name} | iutruyen`
    : `Bảng Xếp Hạng Truyện ${metricSeoLabel} | iutruyen`

  const seoDescription = activeGenre
    ? `Khám phá các bộ truyện ${activeGenre.name} đứng đầu bảng xếp hạng ${metricSeoLabel.toLowerCase()} trên nền tảng đọc truyện chữ iutruyen.`
    : `Bảng vinh danh những tác phẩm truyện chữ xuất sắc đứng đầu về ${metricSeoLabel.toLowerCase()} được độc giả đón đọc nhiều nhất trên iutruyen.`

  useSeoHead({
    title: seoTitle,
    description: seoDescription,
    canonical: 'https://iutruyen.vn/ranking',
    indexable: true,
  })

  // URL state synchronization
  const updateFilter = (key: string, value: string, defaultValue = '') => {
    const params = new URLSearchParams(searchParams)
    if (!value || value === defaultValue) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    setSearchParams(params, { replace: true })
  }

  const handleMetricChange = (newMetric: RankingMetric) => {
    updateFilter('metric', newMetric, 'views')
  }

  const handleGenreChange = (newGenre: string) => {
    updateFilter('genre', newGenre)
  }

  const top3Stories = stories.slice(0, 3)
  const remainingStories = stories.slice(3)

  return (
    <AppLayout showAds>
      {/* Editorial Hero Banner */}
      <RankingHero
        metric={metric}
        onMetricChange={handleMetricChange}
        selectedGenre={selectedGenre}
        onGenreChange={handleGenreChange}
        genres={genres}
      />

      {/* Main Content Area */}
      <main
        id="ranking-content-panel"
        tabIndex={-1}
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 outline-hidden"
      >
        {isError ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border border-destructive/30 bg-destructive/5 shadow-xs"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive mb-3">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="font-serif text-lg sm:text-xl font-bold text-foreground">
              Không thể tải bảng xếp hạng
            </h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-md">
              Đã xảy ra lỗi khi kết nối tới máy chủ hoặc dữ liệu tạm thời chưa sẵn sàng. Vui lòng thử lại.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void refetch()
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Thử lại</span>
            </Button>
          </div>
        ) : isLoading ? (
          <RankingSkeleton />
        ) : stories.length === 0 ? (
          <RankingEmptyState
            selectedGenre={selectedGenre}
            genreName={activeGenre?.name}
            onResetGenre={() => handleGenreChange('')}
          />
        ) : (
          <div className="space-y-12 sm:space-y-14">
            {/* Top 3 Showcase (Podium) */}
            <RankingPodium topStories={top3Stories} metric={metric} />

            {/* Stories from rank #4 onwards */}
            {remainingStories.length > 0 && (
              <section aria-labelledby="ranking-list-heading" className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3.5 flex-wrap gap-2">
                  <h3
                    id="ranking-list-heading"
                    className="font-serif text-lg sm:text-xl font-bold text-foreground"
                  >
                    Các Tác Phẩm Tiếp Theo
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Đang hiển thị <strong className="text-foreground">{stories.length}</strong> tác phẩm
                  </span>
                </div>

                <div className="space-y-3">
                  {remainingStories.map((story, index) => {
                    const rankNumber = index + 4
                    return (
                      <RankingListItem
                        key={story._id}
                        story={story}
                        rankNumber={rankNumber}
                        metric={metric}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            {/* Pagination / Load more */}
            <div className="border-t border-border pt-8 flex flex-col items-center justify-center">
              {hasNextPage ? (
                <>
                  <button
                    type="button"
                    disabled={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                    aria-label="Tải thêm các thứ hạng tiếp theo"
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-3 text-xs sm:text-sm font-bold text-primary-foreground shadow-xs hover:bg-primary-hover active:scale-95 disabled:opacity-50 transition-all cursor-pointer select-none"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Đang tải thêm thứ hạng...</span>
                      </>
                    ) : (
                      <>
                        <span>Xem thêm thứ hạng tiếp theo</span>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </button>
                  <p className="mt-2.5 text-xs text-muted-foreground" aria-live="polite">
                    Đã xem {stories.length} tác phẩm
                  </p>
                </>
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground text-center" aria-live="polite">
                  Đã hiển thị toàn bộ <strong className="text-foreground">{stories.length}</strong> tác phẩm trong bảng xếp hạng.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </AppLayout>
  )
}

export default RankingPage
