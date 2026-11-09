import React from 'react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { ReaderNavigation } from './ReaderNavigation'
import { ReaderAccountMenu } from './ReaderAccountMenu'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { useNotificationSocket } from '@/features/notifications/hooks/useNotificationSocket'
import {
  Heart,
  Bookmark,
  MessageSquare,
  SlidersHorizontal,
  Sun,
  Moon,
  Droplets,
  BookOpen,
  Flag,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useReaderSettingsStore } from '@/features/reader-settings/store/readerSettingsStore'
import { useCheckFollow, useToggleFollow } from '@/features/follows-bookmarks/hooks/useFollows'
import { useCheckBookmark, useToggleBookmark } from '@/features/follows-bookmarks/hooks/useBookmarks'

interface ReaderToolbarProps {
  storyId: string
  chapterId: string
  storyTitle: string
  storySlug: string
  chapterTitle: string
  onOpenSettings: () => void
  onOpenComments: () => void
  onOpenReport: () => void
}

export const ReaderToolbar: React.FC<ReaderToolbarProps> = ({
  storyId,
  chapterId,
  onOpenSettings,
  onOpenComments,
  onOpenReport,
}) => {
  useNotificationSocket()
  const { theme: appTheme, setTheme: setAppTheme, resolvedTheme } = useTheme()
  const { theme: readerTheme, setTheme: setReaderTheme } = useReaderSettingsStore()

  // Follow hook for current story
  const { data: followData } = useCheckFollow(storyId)
  const { mutate: toggleFollow, isPending: isTogglingFollow } = useToggleFollow(storyId)
  const isFollowing = !!followData?.isFollowing

  // Bookmark hook for current chapter
  const { data: bookmarkData } = useCheckBookmark(chapterId)
  const { mutate: toggleBookmark, isPending: isTogglingBookmark } = useToggleBookmark(chapterId)
  const isBookmarked = !!bookmarkData?.bookmarked
  const bookmarkId = bookmarkData?.bookmark?._id

  const THEMES = ['light', 'soft-blue', 'sepia', 'dark'] as const
  const currentTheme = (appTheme ?? resolvedTheme ?? readerTheme ?? 'light') as (typeof THEMES)[number]

  const cycleTheme = () => {
    const index = THEMES.indexOf(currentTheme)
    const next = THEMES[(index + 1) % THEMES.length]
    setAppTheme(next)
    setReaderTheme(next)
  }

  const getThemeIcon = () => {
    if (currentTheme === 'light') return <Sun className="h-4 w-4 text-link" />
    if (currentTheme === 'soft-blue') return <Droplets className="h-4 w-4 text-link" />
    if (currentTheme === 'sepia') return <BookOpen className="h-4 w-4 text-amber-600" />
    return <Moon className="h-4 w-4 text-sky-400" />
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-md transition-colors shadow-xs">
      <div className="mx-auto grid min-h-14 max-w-[1600px] grid-cols-1 items-center gap-2 px-3 py-2 sm:gap-x-4 sm:px-6 lg:px-8 md:flex md:gap-4 md:py-0 md:h-16">
        <div className="flex min-w-0 items-center justify-between gap-3 md:justify-start md:flex-1 md:gap-4">
          <div className="shrink-0">
            <BrandLogo size="md" />
          </div>
          <ReaderNavigation />
        </div>

        <div className="flex min-w-0 items-center justify-between gap-1 sm:gap-2 md:shrink-0 md:justify-end md:gap-3">
          <div role="group" aria-label="Công cụ đọc truyện" className="flex shrink-0 items-center gap-0.5 sm:gap-1 2xl:gap-2">

          {/* 5. Nút Theo Dõi truyện (Lưu vào tủ) */}
          <button
            type="button"
            onClick={() => toggleFollow()}
            disabled={isTogglingFollow}
            className={`flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:h-9 sm:w-9 2xl:w-auto 2xl:px-3 ${
              isFollowing
                ? 'border-primary bg-secondary text-link shadow-xs'
                : 'border-border text-muted-foreground hover:text-link hover:bg-secondary'
            }`}
            title={isFollowing ? 'Đang theo dõi truyện này (Click để hủy)' : 'Theo dõi truyện và lưu vào tủ'}
            aria-label={isFollowing ? 'Hủy theo dõi truyện' : 'Theo dõi truyện'}
            aria-pressed={isFollowing}
          >
            <Heart className={`h-4 w-4 ${isFollowing ? 'fill-primary text-link' : 'text-link'}`} />
            <span className="hidden whitespace-nowrap 2xl:inline">{isFollowing ? 'Đang theo dõi' : 'Theo dõi'}</span>
          </button>

          {/* 5.1 Nút Đánh dấu trang chương (Bookmark) */}
          <button
            type="button"
            onClick={() => toggleBookmark({ isBookmarked, bookmarkId })}
            disabled={isTogglingBookmark}
            className={`flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:h-9 sm:w-9 2xl:w-auto 2xl:px-3 ${
              isBookmarked
                ? 'border-primary bg-secondary text-link shadow-xs'
                : 'border-border text-muted-foreground hover:text-link hover:bg-secondary'
            }`}
            title={isBookmarked ? 'Đã lưu dấu trang chương này (Click để bỏ)' : 'Đánh dấu trang chương này'}
            aria-label={isBookmarked ? 'Bỏ dấu trang chương' : 'Đánh dấu trang chương'}
            aria-pressed={isBookmarked}
          >
            <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-primary text-link' : 'text-link'}`} />
            <span className="hidden whitespace-nowrap 2xl:inline">{isBookmarked ? 'Đã lưu' : 'Dấu trang'}</span>
          </button>

          <div className="mx-0.5 h-4 w-px shrink-0 bg-border sm:mx-1" aria-hidden="true" />

          {/* 6. Quick Theme Cycle */}
          <button
            type="button"
            onClick={cycleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-link hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer sm:h-9 sm:w-9"
            title="Đổi màu nền đọc (Sáng Trắng / Xanh Dịu / Giấy Kem / Đêm Tối)"
            aria-label="Đổi màu nền đọc"
          >
            {getThemeIcon()}
          </button>

          <button
            type="button"
            onClick={onOpenComments}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-link hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer sm:h-9 sm:w-9"
            title="Bình luận chương"
            aria-label="Bình luận chương"
          >
            <MessageSquare className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenReport}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-link hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer sm:h-9 sm:w-9"
            title="Báo cáo vấn đề"
            aria-label="Báo cáo vấn đề"
            aria-haspopup="dialog"
          >
            <Flag className="h-4 w-4" />
          </button>

          {/* 9. Settings Modal Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-link hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer sm:h-9 sm:w-9"
            title="Cài đặt hiển thị đọc"
            aria-label="Cài đặt hiển thị đọc"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          </div>
          <div role="group" aria-label="Thông báo và tài khoản" className="flex shrink-0 items-center gap-1 border-l border-border pl-2 2xl:gap-2 2xl:pl-3">
            <NotificationBell panelClassName="top-full" />
            <ReaderAccountMenu />
          </div>
        </div>
      </div>
    </header>
  )
}

export default ReaderToolbar
