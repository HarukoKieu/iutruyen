import React from 'react'
import { Link } from 'react-router-dom'
import { Crown, ArrowUpRight, BookOpen, Layers } from 'lucide-react'
import { storyAttribution } from '@/features/stories/utils/storyAttribution'
import { RankingCover } from './RankingCover'
import { getStoryMetricDisplay } from './rankingMetricHelper'
import type { Story } from '@/types/story'
import type { RankingMetric } from '@/types/ranking'

interface RankingPodiumProps {
  topStories: Story[]
  metric: RankingMetric
}

export const RankingPodium: React.FC<RankingPodiumProps> = ({
  topStories,
  metric,
}) => {
  if (topStories.length === 0) return null

  const top1 = topStories[0]
  const top2 = topStories.length > 1 ? topStories[1] : null
  const top3 = topStories.length > 2 ? topStories[2] : null

  const top1Metric = getStoryMetricDisplay(top1, metric)
  const top2Metric = top2 ? getStoryMetricDisplay(top2, metric) : null
  const top3Metric = top3 ? getStoryMetricDisplay(top3, metric) : null

  const isSolo = !top2 && !top3
  const isDuo = top2 && !top3

  return (
    <section aria-labelledby="podium-heading" className="relative">
      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1 text-xs font-bold text-link mb-2">
          <Crown className="h-3.5 w-3.5 text-link" aria-hidden="true" />
          <span>Bục Vinh Quang</span>
        </div>
        <h2
          id="podium-heading"
          className="font-serif text-2xl sm:text-3xl font-extrabold text-foreground"
        >
          {isSolo ? 'Tác Phẩm Dẫn Đầu' : isDuo ? 'Top 2 Tác Phẩm Dẫn Đầu' : 'Top 3 Tác Phẩm Dẫn Đầu'}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Thành tích nổi bật nhất trên toàn bộ nền tảng
        </p>
      </div>

      <div
        className={
          isSolo
            ? 'max-w-2xl mx-auto'
            : isDuo
            ? 'grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch'
            : 'grid grid-cols-1 xl:grid-cols-3 gap-6 items-end'
        }
      >
        {/* Top 2 - Silver Card */}
        {top2 && (
          <article
            aria-label={`Hạng 2: ${top2.title}`}
            className="xl:order-1 order-2 rounded-3xl border border-border-strong bg-card/90 backdrop-blur-xs p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-border-strong/80 transition-all relative group flex flex-col justify-between"
          >
            {/* Rank badge */}
            <div className="absolute -top-3.5 left-6 flex items-center gap-1.5 rounded-full bg-slate-800 text-slate-100 dark:bg-slate-200 dark:text-slate-900 px-3 py-1 font-bold text-xs shadow-md">
              <span className="font-mono">#2 BẠC</span>
            </div>

            <div>
              <div className="flex gap-4 pt-1">
                <Link
                  to={`/stories/${top2.slug}`}
                  className="block shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                  aria-label={`Xem chi tiết truyện ${top2.title}`}
                >
                  <RankingCover
                    coverUrl={top2.coverUrl}
                    title={top2.title}
                    className="h-34 w-24 sm:h-36 sm:w-26 shadow-xs"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-md bg-surface-raised border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground mb-1.5">
                    {top2.genreIds?.[0]?.name || 'Truyện chữ'}
                  </span>
                  <Link
                    to={`/stories/${top2.slug}`}
                    className="block font-serif font-bold text-base sm:text-lg text-foreground group-hover:text-link transition-colors line-clamp-2 leading-snug"
                  >
                    {top2.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    Tác giả:{' '}
                    <span className="font-medium text-foreground">
                      {storyAttribution(top2).author}
                    </span>
                  </p>

                  {/* Metric display */}
                  <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-2.5 py-1 text-xs font-semibold text-foreground border border-border">
                    {top2Metric?.icon}
                    <span>{top2Metric?.value}</span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      {top2Metric?.label}
                    </span>
                  </div>
                </div>
              </div>

              {top2.description && (
                <p className="mt-4 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {top2.description}
                </p>
              )}
            </div>

            <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {top2.chapterCount} chương • {top2.status === 'completed' ? 'Full' : 'Đang ra'}
              </span>
              <Link
                to={`/stories/${top2.slug}`}
                className="inline-flex items-center gap-1 font-bold text-link hover:text-link-hover transition-colors"
              >
                <span>Đọc ngay</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </article>
        )}

        {/* Top 1 - Gold Champion Card */}
        <article
          aria-label={`Hạng 1: ${top1.title}`}
          className={`xl:order-2 order-1 rounded-3xl border-2 border-primary/50 bg-gradient-to-b from-primary/10 via-card to-card p-6 sm:p-7 shadow-lg shadow-primary/5 hover:shadow-xl transition-all relative group flex flex-col justify-between ${
            !isSolo && !isDuo ? 'xl:-translate-y-4' : ''
          }`}
        >
          {/* Champion Badge */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-4 py-1.5 font-extrabold text-xs text-white shadow-md">
            <Crown className="h-4 w-4 fill-white" aria-hidden="true" />
            <span className="tracking-wide">QUÁN QUÂN #1</span>
          </div>

          <div>
            <div className="flex gap-4 sm:gap-5 pt-2">
              <Link
                to={`/stories/${top1.slug}`}
                className="block shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                aria-label={`Xem chi tiết truyện ${top1.title}`}
              >
                <RankingCover
                  coverUrl={top1.coverUrl}
                  title={top1.title}
                  priority
                  className="h-40 w-28 sm:h-44 sm:w-32 shadow-md border-primary/30"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="inline-block rounded-md bg-primary/20 text-link px-2.5 py-0.5 text-xs font-bold">
                    {top1.genreIds?.[0]?.name || 'Truyện chữ'}
                  </span>
                  {top1.status === 'completed' && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Đã hoàn thành
                    </span>
                  )}
                </div>

                <Link
                  to={`/stories/${top1.slug}`}
                  className="block font-serif font-extrabold text-lg sm:text-xl text-foreground group-hover:text-link transition-colors line-clamp-2 leading-snug"
                >
                  {top1.title}
                </Link>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground truncate">
                  Tác giả:{' '}
                  <span className="font-semibold text-foreground">
                    {storyAttribution(top1).author}
                  </span>
                </p>

                {/* Metric Counter */}
                <div className="mt-3.5 inline-block rounded-xl bg-surface-raised p-2 sm:p-2.5 border border-border shadow-2xs">
                  <div className="flex flex-wrap items-center gap-1.5 font-extrabold text-sm sm:text-base text-foreground">
                    {top1Metric.icon}
                    <span>{top1Metric.value}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {top1Metric.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {top1.description && (
              <p className="mt-4 text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                {top1.description}
              </p>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-3 items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {top1.chapterCount} chương • {top1.status === 'completed' ? 'Hoàn thành' : 'Đang cập nhật'}
            </span>
            <Link
              to={`/stories/${top1.slug}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-xs hover:bg-primary-hover active:scale-95 transition-all"
            >
              <span>Đọc tác phẩm</span>
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </article>

        {/* Top 3 - Bronze Card */}
        {top3 && (
          <article
            aria-label={`Hạng 3: ${top3.title}`}
            className="xl:order-3 order-3 rounded-3xl border border-amber-900/30 bg-card/90 backdrop-blur-xs p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-amber-900/50 transition-all relative group flex flex-col justify-between"
          >
            {/* Rank badge */}
            <div className="absolute -top-3.5 left-6 flex items-center gap-1.5 rounded-full bg-amber-800 text-amber-50 px-3 py-1 font-bold text-xs shadow-md">
              <span className="font-mono">#3 ĐỒNG</span>
            </div>

            <div>
              <div className="flex gap-4 pt-1">
                <Link
                  to={`/stories/${top3.slug}`}
                  className="block shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                  aria-label={`Xem chi tiết truyện ${top3.title}`}
                >
                  <RankingCover
                    coverUrl={top3.coverUrl}
                    title={top3.title}
                    className="h-34 w-24 sm:h-36 sm:w-26 shadow-xs"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-md bg-surface-raised border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground mb-1.5">
                    {top3.genreIds?.[0]?.name || 'Truyện chữ'}
                  </span>
                  <Link
                    to={`/stories/${top3.slug}`}
                    className="block font-serif font-bold text-base sm:text-lg text-foreground group-hover:text-link transition-colors line-clamp-2 leading-snug"
                  >
                    {top3.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    Tác giả:{' '}
                    <span className="font-medium text-foreground">
                      {storyAttribution(top3).author}
                    </span>
                  </p>

                  {/* Metric display */}
                  <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-2.5 py-1 text-xs font-semibold text-foreground border border-border">
                    {top3Metric?.icon}
                    <span>{top3Metric?.value}</span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      {top3Metric?.label}
                    </span>
                  </div>
                </div>
              </div>

              {top3.description && (
                <p className="mt-4 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {top3.description}
                </p>
              )}
            </div>

            <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {top3.chapterCount} chương • {top3.status === 'completed' ? 'Full' : 'Đang ra'}
              </span>
              <Link
                to={`/stories/${top3.slug}`}
                className="inline-flex items-center gap-1 font-bold text-link hover:text-link-hover transition-colors"
              >
                <span>Đọc ngay</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </article>
        )}
      </div>
    </section>
  )
}
