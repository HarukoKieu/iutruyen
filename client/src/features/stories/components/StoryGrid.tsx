import React from 'react'
import { StoryCard } from './StoryCard'
import { Skeleton } from '@/components/ui/skeleton'
import type { Story } from '@/types/story'

interface StoryGridProps {
  stories: Story[]
  isLoading?: boolean
  skeletonCount?: number
}

const StoryCardSkeleton: React.FC = () => (
  <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-b-2xl border border-border bg-card">
    <Skeleton className="aspect-[5/6] w-full shrink-0 rounded-none" />
    <div className="flex flex-1 flex-col gap-1 p-3">
      <div className="flex h-10 shrink-0 flex-col justify-center gap-1">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-4 w-1/2 shrink-0" />
      <div className="flex h-5 shrink-0 items-center gap-1 overflow-hidden">
        <Skeleton className="h-5 w-12 rounded-md" />
        <Skeleton className="h-5 w-10 rounded-md" />
      </div>
      <div className="mt-auto flex h-[22px] shrink-0 items-center justify-between border-t border-border-subtle pt-1.5">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
  </div>
)

export const StoryGrid: React.FC<StoryGridProps> = ({
  stories,
  isLoading = false,
  skeletonCount = 12,
}) => {
  if (isLoading && stories.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <StoryCardSkeleton key={`skeleton-${i}`} />
        ))}
      </div>
    )
  }

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-muted p-6">
          <svg className="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground">Chưa có truyện nào</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
      {stories.map((story) => (
        <StoryCard key={story._id} story={story} />
      ))}
      {isLoading &&
        Array.from({ length: 6 }).map((_, i) => (
          <StoryCardSkeleton key={`loading-${i}`} />
        ))}
    </div>
  )
}

export default StoryGrid
