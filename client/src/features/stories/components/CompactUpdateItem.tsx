import { storyAttribution } from '@/features/stories/utils/storyAttribution'
import React from 'react'
import { Link } from 'react-router-dom'
import { Clock, BookOpen } from 'lucide-react'
import type { Story } from '@/types/story'

interface CompactUpdateItemProps {
  story: Story
  latestChapterTitle?: string
  updatedAt?: string
}

export const CompactUpdateItem: React.FC<CompactUpdateItemProps> = ({
  story,
  latestChapterTitle,
  updatedAt = 'Vừa cập nhật',
}) => {
  const primaryGenre = story.genreIds?.[0]?.name || 'Truyện chữ'
  const authorName = storyAttribution(story).author

  return (
    <div className="group flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl transition-colors hover:bg-surface-raised border-b border-border-subtle last:border-b-0">
      {/* Left: Thumbnail + Title + Author */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link
          to={`/stories/${story.slug}`}
          className="relative h-12 w-9 shrink-0 overflow-hidden rounded-none border border-border bg-surface-raised"
        >
          {story.coverUrl ? (
            <img src={story.coverUrl} alt={story.title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary text-link">
              <BookOpen className="h-4 w-4" />
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to={`/stories/${story.slug}`}
            className="block font-serif text-sm font-bold text-foreground group-hover:text-link transition-colors truncate"
          >
            {story.title}
          </Link>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 truncate">
            <span className="font-medium text-link/80">[{primaryGenre}]</span>
            <span>•</span>
            <span className="truncate">{authorName}</span>
          </div>
        </div>
      </div>

      {/* Right: Chapter + Relative Time */}
      <div className="shrink-0 text-right">
        <Link
          to={`/stories/${story.slug}`}
          className="text-xs font-semibold text-link hover:underline flex items-center gap-1 justify-end"
        >
          <span>{latestChapterTitle || `Chương ${story.chapterCount || 1}`}</span>
        </Link>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end mt-0.5">
          <Clock className="h-2.5 w-2.5" />
          {updatedAt}
        </span>
      </div>
    </div>
  )
}

export default CompactUpdateItem
