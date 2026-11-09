import { storyAttribution } from '@/features/stories/utils/storyAttribution'
import React from 'react'
import { Link } from 'react-router-dom'
import { Eye, BookOpen, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Story } from '@/types/story'

interface StoryCardProps {
  story: Story
}

const formatCount = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n?.toString() || '0'
}

export const StoryCard: React.FC<StoryCardProps> = ({ story }) => {
  const authorName = storyAttribution(story).author

  const statusLabel = story.status === 'completed' ? 'Full' : story.status === 'hiatus' ? 'Tạm dừng' : 'Đang ra'
  const statusVariant = story.status === 'completed' ? ('success' as const) : ('secondary' as const)

  return (
    <Link
      to={`/stories/${story.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card shadow-card hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-hover transition-all duration-200 overflow-hidden"
    >
      {/* A shorter cover frame keeps the story card compact. */}
      <div className="relative aspect-[5/6] w-full shrink-0 overflow-hidden rounded-none bg-slate-900/5 flex items-center justify-center">
        {story.coverUrl ? (
          <>
            <img
              src={story.coverUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover blur-md opacity-35 scale-125 pointer-events-none"
            />
            <img
              src={story.coverUrl}
              alt={story.title}
              className="relative z-10 max-h-full max-w-full object-contain object-center transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-secondary p-3 text-center">
            <BookOpen className="h-10 w-10 text-link/40 mb-1" />
            <span className="font-serif text-xs font-bold text-foreground line-clamp-2">
              {story.title}
            </span>
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute left-2 top-2">
          <Badge variant={statusVariant} className="text-[10px] backdrop-blur-md bg-opacity-95 shadow-xs">
            {statusLabel}
          </Badge>
        </div>

        {/* 18+ Warning */}
        {story.contentWarning === 'mature18+' && (
          <div className="absolute right-2 top-2">
            <Badge variant="destructive" className="text-[10px] font-bold backdrop-blur-md">
              18+
            </Badge>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="min-h-10 font-serif text-sm font-bold leading-5 line-clamp-2 text-foreground group-hover:text-link transition-colors">
          {story.title}
        </h3>

        <p className="text-xs text-muted-foreground truncate">{authorName}</p>

        {/* Genre tags */}
        {story.genreIds && story.genreIds.length > 0 && (
          <div className="flex min-h-5 min-w-0 items-center gap-1 overflow-hidden">
            {story.genreIds.slice(0, 2).map((g) => (
              <span
                key={g._id}
                title={g.name}
                className="max-w-[calc(50%-2px)] truncate rounded-md bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="mt-auto flex items-center justify-between gap-1 border-t border-border-subtle pt-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3 text-link" />
            {story.chapterCount || 0}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatCount(story.viewCount || 0)}
          </span>
          {story.ratingAverage > 0 && (
            <span className="flex items-center gap-0.5 font-bold text-link">
              <Star className="h-3 w-3 fill-primary" />
              {story.ratingAverage.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default StoryCard
