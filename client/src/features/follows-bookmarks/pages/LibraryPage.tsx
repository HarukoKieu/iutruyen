import { storyAttribution } from '@/features/stories/utils/storyAttribution'
import React, { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookMarked,
  Heart,
  History,
  BookOpen,
  Search,
  Trash2,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useFollowedStories, useToggleFollow } from '../hooks/useFollows'
import { useUserBookmarks, useToggleBookmark } from '../hooks/useBookmarks'
import { useUserReadingHistory } from '../hooks/useReadingHistory'
import type { Story } from '@/types/story'

export type LibraryTab = 'following' | 'bookmarks' | 'history'

interface LibraryPageProps {
  defaultTab?: LibraryTab
}

function UnfollowButton({ storyId, title }: { storyId: string; title: string }) {
  const { mutate: toggleFollow, isPending } = useToggleFollow(storyId)
  return <button type="button" onClick={() => toggleFollow()} disabled={isPending} aria-label={`Bỏ theo dõi ${title}`} title="Bỏ theo dõi" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"><Heart className="h-3.5 w-3.5 fill-primary text-link" /></button>
}

function LibraryLoadError({ onRetry }: { onRetry: () => void }) {
  return <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-6 text-center"><p className="text-sm text-foreground">Không thể tải dữ liệu tủ sách. Vui lòng thử lại.</p><Button variant="outline" size="sm" onClick={onRetry} className="mt-3">Thử lại</Button></div>
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'Vừa xong'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} ngày trước`
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

export const LibraryPage: React.FC<LibraryPageProps> = ({ defaultTab = 'following' }) => {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<LibraryTab>(defaultTab)
  const [searchQuery, setSearchQuery] = useState('')
  useEffect(() => { setActiveTab(defaultTab) }, [defaultTab])

  // Queries
  const followingQuery = useFollowedStories(50)
  const bookmarksQuery = useUserBookmarks()
  const historyQuery = useUserReadingHistory(50)
  const { data: follows = [], isLoading: isLoadingFollows, isError: followsError, refetch: refetchFollows } = followingQuery
  const { data: bookmarks = [], isLoading: isLoadingBookmarks, isError: bookmarksError, refetch: refetchBookmarks } = bookmarksQuery
  const { data: history = [], isLoading: isLoadingHistory, isError: historyError, refetch: refetchHistory } = historyQuery
  const activeQuery = activeTab === 'following' ? followingQuery : activeTab === 'bookmarks' ? bookmarksQuery : historyQuery

  // Mutations
  const { mutate: toggleBookmark } = useToggleBookmark('')

  // Filtered lists
  const filteredFollows = useMemo(() => {
    if (!searchQuery.trim()) return follows
    const q = searchQuery.toLowerCase()
    return follows.filter((f) => {
      const story = f.storyId as Story
      return (
        story?.title?.toLowerCase().includes(q) ||
        story?.authorId?.displayName?.toLowerCase().includes(q)
      )
    })
  }, [follows, searchQuery])

  const filteredBookmarks = useMemo(() => {
    if (!searchQuery.trim()) return bookmarks
    const q = searchQuery.toLowerCase()
    return bookmarks.filter((b) => {
      const story = b.chapterId?.storyId
      const chapterTitle = b.chapterId?.title
      return (
        story?.title?.toLowerCase().includes(q) ||
        chapterTitle?.toLowerCase().includes(q) ||
        b.note?.toLowerCase().includes(q)
      )
    })
  }, [bookmarks, searchQuery])

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history
    const q = searchQuery.toLowerCase()
    return history.filter((h) => {
      const story = typeof h.storyId === 'object' ? h.storyId : null
      const title = story?.title || h.storyTitle || ''
      return title.toLowerCase().includes(q)
    })
  }, [history, searchQuery])

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-link mb-4">
            <BookMarked className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Tủ Sách Cá Nhân</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vui lòng đăng nhập để đồng bộ truyện đang theo dõi, dấu trang và lịch sử đọc trên mọi thiết bị.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate('/login')} className="font-semibold">
              Đăng nhập ngay
            </Button>
            <Button variant="outline" onClick={() => navigate('/stories')}>
              Khám phá truyện
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const tabs = [
    {
      id: 'following' as LibraryTab,
      label: 'Đang theo dõi',
      icon: Heart,
      count: follows.length,
    },
    {
      id: 'bookmarks' as LibraryTab,
      label: 'Dấu trang',
      icon: BookMarked,
      count: bookmarks.length,
    },
    {
      id: 'history' as LibraryTab,
      label: 'Lịch sử đọc',
      icon: History,
      count: history.length,
    },
  ]

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header Banner */}
          <div className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-link">
                    <BookMarked className="h-4 w-4" />
                  </span>
                  <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
                    Tủ Sách Của Tôi
                  </h1>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Quản lý truyện đang theo dõi, dấu trang chương và tiến độ đọc gần đây.
                </p>
              </div>

              {/* Search within library */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Lọc trong tủ sách"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Lọc các mục đã tải…"
                  className="pl-9 text-xs sm:text-sm h-9"
                />
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="mt-6 flex gap-2 border-b border-border/60 pb-px overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-pressed={isActive}
                    className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap
                      ${
                        isActive
                          ? 'border-primary text-link'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isActive ? 'bg-primary/15 text-link' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {activeQuery.hasNextPage && <div className="mb-4 text-center"><Button variant="outline" disabled={activeQuery.isFetchingNextPage} onClick={() => { void activeQuery.fetchNextPage() }}>{activeQuery.isFetchingNextPage ? 'Đang tải…' : 'Tải thêm vào tủ sách'}</Button></div>}
          {/* Tab Content: Following */}
          {activeTab === 'following' && (
            <div>
              {followsError ? <LibraryLoadError onRetry={() => { void refetchFollows() }} /> : isLoadingFollows ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-64 animate-pulse rounded-xl bg-muted/60" />
                  ))}
                </div>
              ) : filteredFollows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-link mb-3">
                    <Heart className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-foreground">Chưa có truyện theo dõi</h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    {searchQuery
                      ? 'Không tìm thấy truyện nào phù hợp với từ khóa tìm kiếm.'
                      : 'Hãy bấm nút "Theo dõi" ở các bộ truyện bạn yêu thích để nhận thông báo chương mới nhất.'}
                  </p>
                  <Button asChild className="mt-4 gap-1.5 font-semibold" size="sm">
                    <Link to="/stories">
                      <Sparkles className="h-3.5 w-3.5" />
                      Khám phá truyện hay
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {filteredFollows.map((item) => {
                    const story = item.storyId as Story
                    if (!story || typeof story !== 'object') return null

                    return (
                      <div
                        key={item._id}
                        className="group relative flex flex-col overflow-hidden rounded-b-xl border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                      >
                        {/* Cover Image */}
                        <Link
                          to={`/stories/${story.slug}`}
                          className="relative aspect-[2/3] w-full overflow-hidden bg-muted block"
                        >
                          {story.coverUrl ? (
                            <img
                              src={story.coverUrl}
                              alt={story.title}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5 text-link">
                              <BookOpen className="h-8 w-8 opacity-40" />
                            </div>
                          )}

                          {story.status && (
                            <span
                              className={`absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-bold backdrop-blur-md ${
                                story.status === 'completed'
                                  ? 'bg-emerald-500/90 text-white'
                                  : 'bg-black/60 text-white'
                              }`}
                            >
                              {story.status === 'completed' ? 'Hoàn thành' : 'Đang ra'}
                            </span>
                          )}
                        </Link>

                        {/* Story Meta */}
                        <div className="flex flex-1 flex-col p-3">
                          <Link
                            to={`/stories/${story.slug}`}
                            className="font-semibold text-xs sm:text-sm text-foreground hover:text-link line-clamp-2 transition-colors leading-snug"
                            title={story.title}
                          >
                            {story.title}
                          </Link>

                          <p className="mt-1 text-[11px] text-muted-foreground truncate">
                            {storyAttribution(story).author}
                          </p>

                          <div className="mt-auto pt-2 flex items-center justify-between border-t border-border/50 text-[11px] text-muted-foreground">
                            <span>{story.chapterCount || 0} chương</span>
                            <UnfollowButton storyId={story._id} title={story.title} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Bookmarks */}
          {activeTab === 'bookmarks' && (
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              {bookmarksError ? <LibraryLoadError onRetry={() => { void refetchBookmarks() }} /> : isLoadingBookmarks ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Đang tải danh sách dấu trang…
                </div>
              ) : filteredBookmarks.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-link mb-3">
                    <BookMarked className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-foreground">Chưa có dấu trang nào</h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    {searchQuery
                      ? 'Không tìm thấy dấu trang phù hợp với từ khóa.'
                      : 'Khi đang đọc chương truyện, hãy bấm biểu tượng Dấu trang để lưu lại vị trí đoạn văn hoặc chương cần đọc lại.'}
                  </p>
                  <Button asChild className="mt-4 gap-1.5 font-semibold" size="sm">
                    <Link to="/stories">Đọc truyện ngay</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredBookmarks.map((b) => {
                    const chapter = b.chapterId
                    const story = chapter?.storyId
                    const storySlug = story?.slug || ''
                    const chapterSlug = chapter?.slug || ''
                    const link =
                      storySlug && chapterSlug
                        ? `/stories/${storySlug}/chapters/${chapterSlug}`
                        : '#'

                    return (
                      <div
                        key={b._id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-link">
                            <BookMarked className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              to={link}
                              className="font-semibold text-sm text-foreground hover:text-link transition-colors line-clamp-1"
                            >
                              {story?.title || 'Truyện'} — {chapter?.title || 'Chương'}
                            </Link>
                            {b.note && (
                              <p className="mt-0.5 text-xs text-muted-foreground italic line-clamp-2">
                                "{b.note}"
                              </p>
                            )}
                            <p className="mt-1 text-[11px] text-muted-foreground/70">
                              Lưu lúc: {timeAgo(b.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <Button asChild size="sm" variant="outline" className="gap-1 text-xs h-8">
                            <Link to={link}>
                              <span>Đọc</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <button
                            type="button"
                            onClick={() =>
                              toggleBookmark({
                                isBookmarked: true,
                                bookmarkId: b._id,
                              })
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Xóa dấu trang"
                            aria-label="Xóa dấu trang"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab Content: History */}
          {activeTab === 'history' && (
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              {historyError ? <LibraryLoadError onRetry={() => { void refetchHistory() }} /> : isLoadingHistory ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Đang tải lịch sử đọc…
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-link mb-3">
                    <History className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-foreground">Chưa có lịch sử đọc</h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    {searchQuery
                      ? 'Không tìm thấy lịch sử phù hợp với từ khóa.'
                      : 'Hệ thống sẽ tự động lưu lại các chương bạn vừa đọc để bạn có thể tiếp tục bất cứ lúc nào.'}
                  </p>
                  <Button asChild className="mt-4 gap-1.5 font-semibold" size="sm">
                    <Link to="/stories">Tìm truyện đọc ngay</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredHistory.map((item, idx) => {
                    const story = typeof item.storyId === 'object' ? item.storyId : null
                    const chapter = typeof item.lastChapterId === 'object' ? item.lastChapterId : null

                    const storyTitle = story?.title || item.storyTitle || 'Truyện'
                    const storySlug = story?.slug || item.storySlug || ''
                    const chapterTitle =
                      chapter?.title || item.chapterTitle || (item.chapterNumber ? `Chương ${item.chapterNumber}` : 'Chương')
                    const chapterSlug = chapter?.slug || item.chapterId || ''
                    const cover = story?.coverUrl || item.coverUrl

                    const link =
                      storySlug && chapterSlug
                        ? `/stories/${storySlug}/chapters/${chapterSlug}`
                        : storySlug
                        ? `/stories/${storySlug}`
                        : '#'

                    return (
                      <div
                        key={item._id || idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-none bg-muted border border-border">
                            {cover ? (
                              <img src={cover} alt={storyTitle} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                <BookOpen className="h-4 w-4 opacity-50" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/stories/${storySlug}`}
                              className="font-bold text-sm text-foreground hover:text-link transition-colors truncate block"
                            >
                              {storyTitle}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                              <span className="font-medium text-link">Đã đọc đến:</span>
                              <span className="truncate">{chapterTitle}</span>
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                              Lần đọc gần nhất: {timeAgo(item.lastReadAt)}
                            </p>
                          </div>
                        </div>

                        <div className="self-end sm:self-center">
                          <Button asChild size="sm" className="gap-1 text-xs h-8 font-semibold">
                            <Link to={link}>
                              <span>Đọc tiếp</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

export default LibraryPage
