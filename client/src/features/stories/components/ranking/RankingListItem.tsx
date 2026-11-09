import React from 'react'
import { Link } from 'react-router-dom'
import { storyAttribution } from '@/features/stories/utils/storyAttribution'
import { RankingCover } from './RankingCover'
import { getStoryMetricDisplay } from './rankingMetricHelper'
import type { Story } from '@/types/story'
import type { RankingMetric } from '@/types/ranking'

interface RankingListItemProps {
  story: Story
  rankNumber: number
  metric: RankingMetric
}

export const RankingListItem: React.FC<RankingListItemProps> = ({
  story,
  rankNumber,
  metric,
}) => {
  const metricInfo = getStoryMetricDisplay(story, metric)
  const authorName = storyAttribution(story).author
  const isCompleted = story.status === 'completed'
  const genreName = story.genreIds?.[0]?.name || 'Truyện chữ'

  const formattedRank = rankNumber < 10 ? `0${rankNumber}` : `${rankNumber}`

  return (
    <article
      aria-label={`Hạng ${rankNumber}: ${story.title}`}
      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs hover:border-primary/40 hover:bg-surface-raised/40 transition-all duration-200"
    >
      <div className="flex items-center gap-3.5 sm:gap-4.5 min-w-0 flex-1">
        {/* Rank Number Badge */}
        <div
          aria-label={`Hạng ${rankNumber}`}
          className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-surface-raised border border-border font-serif font-black text-sm sm:text-base text-foreground/90 group-hover:border-primary/40 group-hover:text-link group-hover:bg-primary/5 transition-colors select-none"
        >
          {formattedRank}
        </div>

        {/* Cover thumbnail */}
        <Link
          to={`/stories/${story.slug}`}
          className="shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          aria-label={`Xem chi tiết truyện ${story.title}`}
        >
          <RankingCover
            coverUrl={story.coverUrl}
            title={story.title}
            className="h-20 w-15 sm:h-22 sm:w-16 shadow-xs"
          />
        </Link>

        {/* Title and metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-block rounded-md bg-surface-raised border border-border px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-muted-foreground">
              {genreName}
            </span>
            {isCompleted && (
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Full
              </span>
            )}
          </div>

          <Link
            to={`/stories/${story.slug}`}
            className="block font-serif font-bold text-sm sm:text-base text-foreground group-hover:text-link transition-colors line-clamp-2 leading-snug"
          >
            {story.title}
          </Link>

          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>
              Tác giả: <strong className="text-foreground/80 font-medium">{authorName}</strong>
            </span>
            <span aria-hidden="true">•</span>
            <span>{story.chapterCount} chương</span>
            <span aria-hidden="true">•</span>
            <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
              {isCompleted ? 'Hoàn thành' : 'Đang ra'}
            </span>
          </div>
        </div>
      </div>

      {/* Metric & CTA button */}
      <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pl-13.5 sm:pl-0 border-t sm:border-t-0 border-border/50 pt-2.5 sm:pt-0">
        <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-foreground">
          {metricInfo.icon}
          <span>{metricInfo.value}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {metricInfo.label}
          </span>
        </div>

        <Link
          to={`/stories/${story.slug}`}
          className="rounded-xl border border-border bg-surface-raised px-4 py-2 text-xs font-bold text-foreground group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground active:scale-95 transition-all shadow-2xs min-h-[38px] inline-flex items-center justify-center"
        >
          Đọc truyện
        </Link>
      </div>
    </article>
  )
}
