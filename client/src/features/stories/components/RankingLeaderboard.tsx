import { storyAttribution } from '@/features/stories/utils/storyAttribution'
import React from 'react'
import { Link } from 'react-router-dom'
import { Flame, Trophy } from 'lucide-react'
import type { Story } from '@/types/story'

interface RankingLeaderboardProps {
  stories: Story[]
  isLoading?: boolean
}

export const RankingLeaderboard: React.FC<RankingLeaderboardProps> = ({ stories, isLoading }) => {
  const formatViews = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n?.toString() || '0'
  }

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-xs text-primary-foreground shadow-xs">
          01
        </span>
      )
    }
    if (index === 1) {
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary font-bold text-xs text-link border border-primary/20 shadow-xs">
          02
        </span>
      )
    }
    if (index === 2) {
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface-raised font-bold text-xs text-foreground border border-border shadow-xs">
          03
        </span>
      )
    }
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface-raised font-semibold text-xs text-muted-foreground">
        {index < 9 ? `0${index + 1}` : index + 1}
      </span>
    )
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-card">
      {/* Header with Title & Timeframe Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-link" />
          <h3 className="font-serif text-base sm:text-lg font-bold tracking-tight text-foreground">
            Bảng Xếp Hạng
          </h3>
        </div>

        {/* Time Tabs */}
        <div className="flex items-center rounded-full bg-surface-raised p-0.5 text-[11px] font-medium">
          <Link to="/ranking" className="rounded-full px-2.5 py-2 text-muted-foreground hover:text-link">Tất cả</Link>
        </div>
      </div>

      {/* Stories List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-6 w-6 rounded-lg bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {stories.slice(0, 10).map((story, index) => {
            const authorName = storyAttribution(story).author

            return (
              <div
                key={story._id}
                className="group flex items-center justify-between gap-3 py-2 hover:bg-surface-raised px-2.5 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getRankBadge(index)}

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/stories/${story.slug}`}
                      className="block font-serif text-sm font-bold text-foreground group-hover:text-link transition-colors truncate"
                    >
                      {story.title}
                    </Link>
                    <p className="text-[11px] text-muted-foreground truncate">{authorName}</p>
                  </div>
                </div>

                {/* Heat Metric */}
                <div className="flex items-center gap-1 text-xs font-semibold text-link shrink-0">
                  <Flame className="h-3.5 w-3.5 fill-primary/30 text-link" />
                  <span>{formatViews(story.viewCount || 0)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* View All link */}
      <div className="mt-4 pt-3 border-t border-border text-center">
        <Link
          to="/ranking"
          className="text-xs font-semibold text-link hover:text-link-hover transition-colors"
        >
          Xem toàn bộ bảng xếp hạng →
        </Link>
      </div>
    </div>
  )
}

export default RankingLeaderboard
