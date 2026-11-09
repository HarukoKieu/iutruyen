import { storyAttribution } from '@/features/stories/utils/storyAttribution'
import React from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Star, Feather } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Story } from '@/types/story'

interface FeaturedStoryCardProps {
  story: Story
  curatorNote?: string
}

export const FeaturedStoryCard: React.FC<FeaturedStoryCardProps> = ({
  story,
  curatorNote = 'Lời khuyên từ Biên Tập Viên: Một thế giới được xây dựng công phu, chiều sâu nhân vật xuất sắc và tiết tấu truyện cuốn hút.',
}) => {
  const authorName = storyAttribution(story).author

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-card transition-all duration-300 hover:border-primary/50 hover:shadow-hover">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
        {/* Cover 2:3 */}
        <div className="sm:col-span-4 lg:col-span-3 flex justify-center">
          <Link
            to={`/stories/${story.slug}`}
            className="relative aspect-[2/3] w-36 sm:w-full overflow-hidden rounded-none border border-border bg-slate-900/5 shadow-xs transition-transform duration-300 group-hover:scale-105 flex items-center justify-center"
          >
            {story.coverUrl ? (
              <>
                <img
                  loading="lazy"
                  decoding="async"
                  src={story.coverUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover blur-md opacity-35 scale-125 pointer-events-none"
                />
                <img
                  src={story.coverUrl}
                  alt={story.title}
                  className="relative z-10 max-h-full max-w-full object-contain object-center"
                  loading="lazy"
                  decoding="async"
                />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-secondary p-3 text-center">
                <BookOpen className="h-8 w-8 text-link/40" />
              </div>
            )}
          </Link>
        </div>

        {/* Content & Excerpt */}
        <div className="sm:col-span-8 lg:col-span-9 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-primary/30 px-2.5 py-0.5 text-[11px] font-bold text-link">
              <Feather className="h-3 w-3" />
              BIÊN TẬP VIÊN ĐỀ CỬ
            </span>
            {story.status === 'completed' && (
              <Badge variant="success" className="text-[10px]">
                Đã Hoàn Thành
              </Badge>
            )}
          </div>

          <Link to={`/stories/${story.slug}`} className="block">
            <h3 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-foreground group-hover:text-link transition-colors line-clamp-1">
              {story.title}
            </h3>
          </Link>

          <p className="text-xs text-muted-foreground font-medium">
            Tác giả: <strong className="text-foreground">{authorName}</strong>
          </p>

          {/* Curator Note quote box */}
          <div className="rounded-xl bg-surface-raised border-l-2 border-primary p-3 text-xs text-muted-foreground italic line-clamp-2">
            "{curatorNote}"
          </div>

          {/* Genres & Stats */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border-subtle text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              {story.genreIds?.slice(0, 3).map((g) => (
                <span
                  key={g._id}
                  className="rounded-md bg-surface-raised px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {g.name}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-link" />
                {story.chapterCount || 0} chương
              </span>
              {story.ratingAverage > 0 && (
                <span className="flex items-center gap-1 font-bold text-link">
                  <Star className="h-3 w-3 fill-primary" />
                  {story.ratingAverage.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeaturedStoryCard
