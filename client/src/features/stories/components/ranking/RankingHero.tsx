import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, ChevronRight, Flame, Heart, Star, BookOpen, Clock, Sparkles } from 'lucide-react'
import type { RankingMetric } from '@/types/ranking'
import type { Genre } from '@/types/genre'

interface RankingHeroProps {
  metric: RankingMetric
  onMetricChange: (metric: RankingMetric) => void
  selectedGenre: string
  onGenreChange: (genreSlug: string) => void
  genres: Genre[]
}

const METRIC_TABS = [
  {
    id: 'views' as const,
    label: 'Lượt đọc nhiều nhất',
    sub: 'Top thịnh hành',
    icon: Flame,
    color: 'text-amber-500',
    activeBorder: 'border-amber-500/50',
    activeBg: 'bg-amber-500/10',
  },
  {
    id: 'follows' as const,
    label: 'Được theo dõi nhất',
    sub: 'Độc giả yêu thích',
    icon: Heart,
    color: 'text-rose-500',
    activeBorder: 'border-rose-500/50',
    activeBg: 'bg-rose-500/10',
  },
  {
    id: 'rating' as const,
    label: 'Đánh giá cao nhất',
    sub: 'Chất lượng xuất sắc',
    icon: Star,
    color: 'text-amber-500',
    activeBorder: 'border-amber-500/50',
    activeBg: 'bg-amber-500/10',
  },
  {
    id: 'chapters' as const,
    label: 'Quy mô chương',
    sub: 'Tác phẩm đồ sộ',
    icon: BookOpen,
    color: 'text-emerald-500',
    activeBorder: 'border-emerald-500/50',
    activeBg: 'bg-emerald-500/10',
  },
]

export const RankingHero: React.FC<RankingHeroProps> = ({
  metric,
  onMetricChange,
  selectedGenre,
  onGenreChange,
  genres,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeGenre = genres.find((g) => g._id === selectedGenre || g.slug === selectedGenre)

  const handleKeyDownOnTab = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    let nextIndex = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % METRIC_TABS.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + METRIC_TABS.length) % METRIC_TABS.length
    }

    if (nextIndex !== -1) {
      e.preventDefault()
      const nextTab = METRIC_TABS[nextIndex]
      onMetricChange(nextTab.id)
    }
  }

  return (
    <div className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/10 via-surface-raised/40 to-background">
      {/* Decorative ambient gradients */}
      <div
        className="absolute top-0 right-0 -z-10 translate-x-1/4 -translate-y-1/4 w-96 h-96 rounded-full bg-primary/15 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 -z-10 -translate-x-1/4 translate-y-1/4 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap"
        >
          <Link to="/" className="hover:text-link transition-colors font-medium">
            Trang chủ
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <Link
            to="/ranking"
            className={`transition-colors font-medium ${
              !activeGenre ? 'text-foreground font-semibold' : 'hover:text-link'
            }`}
          >
            Bảng xếp hạng
          </Link>
          {activeGenre && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="font-semibold text-link">{activeGenre.name}</span>
            </>
          )}
        </nav>

        {/* Title row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="flex h-13 w-13 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 text-link shadow-xs">
              <Trophy className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
                  Bảng Xếp Hạng Truyện
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/25 px-2.5 py-0.5 text-[11px] font-semibold text-link">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  Uy tín
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                Vinh danh những tác phẩm xuất sắc nhất được độc giả đón đọc và yêu thích trên nền tảng.
              </p>
            </div>
          </div>

          {/* Time period indicator */}
          <div className="flex items-center gap-2 self-start lg:self-auto rounded-xl bg-surface-raised border border-border px-3.5 py-2 shadow-2xs">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Kỳ thống kê:</span>
            <span className="text-xs font-bold text-foreground">Toàn thời gian (Tích lũy)</span>
          </div>
        </div>

        {/* Metric Selection Tabs */}
        <div
          role="tablist"
          aria-label="Tiêu chí xếp hạng"
          className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5"
        >
          {METRIC_TABS.map((tab, idx) => {
            const Icon = tab.icon
            const isActive = metric === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls="ranking-content-panel"
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => onMetricChange(tab.id)}
                onKeyDown={(e) => handleKeyDownOnTab(e, idx)}
                className={`group flex items-center gap-3 rounded-2xl p-3 sm:p-4 text-left transition-all border cursor-pointer select-none ${
                  isActive
                    ? `${tab.activeBorder} ${tab.activeBg} shadow-sm border-2 text-foreground`
                    : 'border-border bg-card/80 hover:bg-card hover:border-border-strong text-muted-foreground'
                }`}
              >
                <div
                  className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition-all ${
                    isActive
                      ? 'bg-card shadow-xs text-foreground'
                      : 'bg-surface-raised group-hover:scale-105'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${tab.color}`} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-serif text-xs sm:text-sm truncate ${
                      isActive ? 'font-bold text-foreground' : 'font-semibold group-hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{tab.sub}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Genre Filter Pills */}
        <div className="mt-6">
          <div
            ref={scrollRef}
            role="region"
            aria-label="Lọc theo thể loại"
            tabIndex={0}
            className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scroll-smooth focus:outline-hidden focus:ring-1 focus:ring-ring rounded-lg"
          >
            <span className="text-xs font-bold text-muted-foreground shrink-0 mr-1 select-none">
              Thể loại:
            </span>
            <button
              type="button"
              onClick={() => onGenreChange('')}
              aria-pressed={!selectedGenre}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                !selectedGenre
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              Tất cả
            </button>
            {genres.map((g) => {
              const isSelected = selectedGenre === g.slug || selectedGenre === g._id
              return (
                <button
                  key={g._id}
                  type="button"
                  onClick={() => onGenreChange(g.slug)}
                  aria-pressed={isSelected}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover'
                  }`}
                >
                  {g.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
