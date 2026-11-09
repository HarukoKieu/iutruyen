import React, { useContext, useState } from 'react'
import { RenderClock } from '@/lib/seo/renderClock'
import { Link } from 'react-router-dom'
import { ChevronRight, Clock, Star, Trophy } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { StoryCard } from '@/features/stories/components/StoryCard'
import { HeroSpotlight } from '@/features/stories/components/HeroSpotlight'
import { CompactUpdateItem } from '@/features/stories/components/CompactUpdateItem'
import { RankingLeaderboard } from '@/features/stories/components/RankingLeaderboard'
import { ContinueReadingRibbon } from '@/features/stories/components/ContinueReadingRibbon'
import { Skeleton } from '@/components/ui/skeleton'
import { useStories } from '@/features/stories/hooks/useStories'
import { Button } from '@/components/ui/button'

const SectionHeader: React.FC<{
  icon: React.ReactNode
  title: string
  linkTo: string
  linkLabel?: string
}> = ({ icon, title, linkTo, linkLabel = 'Xem tất cả' }) => (
  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
    <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight flex min-w-0 items-center gap-2.5 text-foreground">
      {icon}
      {title}
    </h2>
    <Link
      to={linkTo}
      className="flex items-center gap-1 text-sm font-semibold text-link hover:text-link-hover transition-colors"
    >
      {linkLabel}
      <ChevronRight className="h-4 w-4" />
    </Link>
  </div>
)

const formatRelativeTime = (dateStr: string, now: number): string => {
  const diff = now - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Date(dateStr).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

export const HomePage: React.FC = () => {
  const clock = useContext(RenderClock)
  const [fallbackClock] = useState(() => Date.now())
  const now = clock || fallbackClock
  const { data: hotData, isLoading: hotLoading, isError: hotError, refetch: retryHot } = useStories({ sort: 'hot', limit: 12 })
  const { data: newData, isLoading: newLoading, isError: newError, refetch: retryNew } = useStories({ sort: 'new', limit: 12 })

  const hotStories = hotData?.pages.flatMap((p) => p.stories) ?? []
  const newStories = newData?.pages.flatMap((p) => p.stories) ?? []


  return (
    <AppLayout showAds>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="sr-only">iutruyen — Thư viện truyện chữ miễn phí</h1>
        {(hotError || newError) && <div role="alert" className="mt-6 rounded-2xl border border-destructive/30 bg-card p-5 text-sm"><p>Một số danh sách truyện chưa tải được. Vui lòng thử lại.</p><Button variant="outline" size="sm" onClick={() => { if (hotError) void retryHot(); if (newError) void retryNew() }} className="mt-3">Thử lại</Button></div>}
        {/* Section 1: Hero Spotlight */}
        <section className="pt-6 sm:pt-8 pb-10 sm:pb-14">
          <HeroSpotlight stories={hotStories} isLoading={hotLoading} />
        </section>

        {/* Section 2: Continue Reading */}
        <section className="pb-10 sm:pb-14">
          <ContinueReadingRibbon />
        </section>

        {/* Section 4: Split — Updates + Ranking */}
        <section className="pb-10 sm:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Latest Updates */}
            <div className="lg:col-span-8">
              <SectionHeader
                icon={<Clock className="h-5 w-5 text-link" />}
                title="Mới Cập Nhật"
                linkTo="/stories?sort=new"
              />
              <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card">
                {newLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-xl" />
                    ))}
                  </div>
                ) : newStories.length > 0 ? (
                  newStories.slice(0, 8).map((story) => (
                    <CompactUpdateItem
                      key={story._id}
                      story={story}
                      latestChapterTitle={
                        story.chapterCount > 0 ? `Chương ${story.chapterCount}` : undefined
                      }
                      updatedAt={formatRelativeTime(story.updatedAt, now)}
                    />
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Chưa có truyện cập nhật.
                  </p>
                )}
              </div>
            </div>

            {/* Ranking Leaderboard */}
            <div className="lg:col-span-4">
              <SectionHeader
                icon={<Trophy className="h-5 w-5 text-link" />}
                title="Top 10"
                linkTo="/ranking"
                linkLabel="Xem bảng xếp hạng"
              />
              <RankingLeaderboard
                stories={hotStories.length > 0 ? hotStories : newStories}
                isLoading={hotLoading && newLoading}
              />
            </div>
          </div>
        </section>

        {/* Section 5: Truyện Hot Đề Cử */}
        <section className="pb-12 sm:pb-16">
          <SectionHeader
            icon={<Star className="h-5 w-5 text-link" />}
            title="Truyện Hot Đề Cử"
            linkTo="/stories?sort=hot"
          />
          {hotLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <Skeleton className="aspect-[5/6] rounded-none" />
                  <div className="space-y-1 p-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-[22px] w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : hotStories.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
              {hotStories.slice(0, 6).map((story) => (
                <StoryCard key={story._id} story={story} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Chưa có truyện đề cử.
            </p>
          )}
        </section>
      </div>
    </AppLayout>
  )
}

export default HomePage
