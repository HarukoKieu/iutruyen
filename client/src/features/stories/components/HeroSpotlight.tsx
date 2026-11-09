import { storyAttribution } from '@/features/stories/utils/storyAttribution'
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Star, Flame, ChevronLeft, ChevronRight, Eye, Bookmark, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Story } from '@/types/story'

interface HeroSpotlightProps {
  stories: Story[]
  isLoading?: boolean
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({ stories, isLoading }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const spotlightStories = stories.slice(0, 6)

  // Auto slide every 6 seconds
  useEffect(() => {
    if (spotlightStories.length <= 1 || isPaused || isHovered || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % spotlightStories.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [spotlightStories.length, isPaused, isHovered])

  if (isLoading) {
    return (
      <div className="relative w-full overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10 animate-pulse min-h-[380px] flex items-center shadow-card">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="h-6 w-32 rounded-full bg-muted" />
            <div className="h-10 w-3/4 rounded-xl bg-muted" />
            <div className="h-16 w-full rounded-xl bg-muted" />
            <div className="h-10 w-48 rounded-full bg-muted" />
          </div>
          <div className="hidden lg:flex lg:col-span-4 justify-center">
            <div className="aspect-[2/3] w-48 rounded-none bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  if (!spotlightStories.length) return <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Chưa có tác phẩm tâm điểm.</div>

  const current = spotlightStories[currentIndex] || spotlightStories[0]
  const authorName = storyAttribution(current).author

  const formatCount = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n?.toString() || '0'
  }

  return (
    <div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onFocusCapture={() => setIsPaused(true)} aria-roledescription="băng chuyền" aria-label="Tác phẩm tâm điểm" className="relative w-full overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-surface-raised p-5 sm:p-10 lg:p-12 shadow-card">
      {/* Subtle Ambient Sky Blue Glow */}
      <div className="absolute -right-10 -top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-10 -bottom-10 h-72 w-72 rounded-full bg-secondary blur-3xl pointer-events-none" />

      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        {/* Left Column: Metadata, Title, Synopsis, Dual CTA */}
        <div className="min-w-0 lg:col-span-8 space-y-4 sm:space-y-5">
          {/* Spotlight Tag & Rating */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-primary/30 px-3 py-1 text-xs font-bold text-link">
              <Flame className="h-3.5 w-3.5 text-link" />
              TÁC PHẨM TÂM ĐIỂM
            </span>

            {current.ratingAverage > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-link">
                <Star className="h-3.5 w-3.5 fill-primary" />
                {current.ratingAverage.toFixed(1)}/5.0
              </span>
            )}

            <Badge variant="subtle" className="text-xs">
              {current.status === 'completed' ? 'Hoàn thành' : 'Đang cập nhật'}
            </Badge>
          </div>

          {/* Header Row: Cover (Mobile/Tablet only) + Single Semantic Title */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-start gap-4">
              <Link
                to={`/stories/${current.slug}`}
                className="relative aspect-[2/3] w-24 sm:w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-slate-900/5 shadow-md flex items-center justify-center lg:hidden group"
              >
                {current.coverUrl ? (
                  <img
                    src={current.coverUrl}
                    alt={current.title}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-secondary text-link">
                    <BookOpen className="h-6 w-6" />
                  </div>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <h2 className="break-words font-serif text-2xl sm:text-3xl lg:text-5xl font-bold tracking-tight text-foreground line-clamp-3 lg:line-clamp-2 leading-tight">
                  {current.title}
                </h2>
              </div>
            </div>

            {/* Author & Quick Metrics */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground font-medium">
              <span>
                Bởi <strong className="text-foreground">{authorName}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4 text-link" />
                {current.chapterCount || 0} chương
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4 text-link" />
                {formatCount(current.viewCount || 0)} lượt đọc
              </span>
            </div>
          </div>

          {/* Synopsis hook */}
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed line-clamp-3 max-w-2xl font-sans">
            {current.description || 'Một tác phẩm đặc sắc đầy lôi cuốn, mở ra thế giới kỳ ảo với những tình tiết hấp dẫn không thể bỏ lỡ...'}
          </p>

          {/* Genres */}
          {current.genreIds && current.genreIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {current.genreIds.slice(0, 4).map((g) => (
                <span
                  key={g._id}
                  className="rounded-lg bg-surface-raised border border-border-subtle px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-link transition-colors"
                >
                  #{g.name}
                </span>
              ))}
            </div>
          )}

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Button asChild variant="default" size="default" className="rounded-full h-11 sm:h-12 px-6 sm:px-7 text-sm sm:text-base font-semibold shadow-sm shadow-primary/25">
              <Link to={`/stories/${current.slug}`}>
                <BookOpen className="h-4 w-4" />
                Đọc Ngay Tác Phẩm
              </Link>
            </Button>

            <Button asChild variant="secondary" size="default" className="rounded-full h-11 sm:h-12 px-6 sm:px-7 text-sm sm:text-base font-semibold">
              <Link to={`/stories/${current.slug}`}>
                <Bookmark className="h-4 w-4" />
                Chi Tiết & Mục Lục
              </Link>
            </Button>
          </div>
        </div>

        {/* Right Column: 2:3 Golden Ratio Poster */}
        <div className="hidden lg:flex lg:col-span-4 justify-center">
          <Link
            to={`/stories/${current.slug}`}
            className="group relative aspect-[2/3] w-48 sm:w-56 overflow-hidden rounded-2xl border border-border bg-slate-900/5 shadow-card transition-all duration-300 hover:shadow-hover hover:-translate-y-1 flex items-center justify-center"
          >
            {current.coverUrl ? (
              <>
                <img
                  decoding="async"
                  src={current.coverUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover blur-lg opacity-40 scale-125 pointer-events-none"
                />
                <img
                  decoding="async"
                  fetchPriority="high"
                  src={current.coverUrl}
                  alt={current.title}
                  className="relative z-10 max-h-full max-w-full object-contain object-center transition-transform duration-300 group-hover:scale-105"
                />
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-secondary via-card to-surface-raised p-4 text-center">
                <BookOpen className="h-12 w-12 text-link/50 mb-2" />
                <span className="font-serif text-sm font-bold text-foreground line-clamp-3">
                  {current.title}
                </span>
              </div>
            )}
            <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4 pointer-events-none">
              <span className="text-xs font-semibold text-white">Xem tác phẩm →</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Slide Navigation Dots & Arrows */}
      {spotlightStories.length > 1 && (
        <div className="mt-8 pt-4 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {spotlightStories.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Slide ${idx + 1}`}
                aria-pressed={idx === currentIndex}
                className="flex h-6 w-6 items-center justify-center rounded-full cursor-pointer"
              ><span className={`h-2 rounded-full transition-all ${idx === currentIndex ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40'}`} /></button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" aria-label={isPaused ? 'Tiếp tục tự chuyển truyện' : 'Tạm dừng tự chuyển truyện'} onClick={() => setIsPaused(paused => !paused)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-link cursor-pointer">{isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => (prev - 1 + spotlightStories.length) % spotlightStories.length)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-link hover:bg-secondary transition-colors cursor-pointer shadow-xs"
              aria-label="Truyện trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => (prev + 1) % spotlightStories.length)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-link hover:bg-secondary transition-colors cursor-pointer shadow-xs"
              aria-label="Truyện kế tiếp"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default HeroSpotlight
