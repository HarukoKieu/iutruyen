import { storyAttribution, descriptionWithSourceName } from '@/features/stories/utils/storyAttribution'
import React, { useState, useMemo, useEffect, useContext, useRef } from 'react'
import { RenderClock } from '@/lib/seo/renderClock'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen,
  Eye,
  Heart,
  Star,
  ChevronRight,
  User,
  PenTool,
  ArrowUpDown,
  Search,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  Flame,
  ListOrdered,
  FileText,
  Tag,
  Camera,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useStory } from '../hooks/useStory'
import { useMatureConfirmation } from '../hooks/useMatureConfirmation'
import { useStories } from '../hooks/useStories'
import { useChapters } from '@/features/chapters/hooks/useChapters'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useCheckFollow, useToggleFollow } from '@/features/follows-bookmarks/hooks/useFollows'
import { Mature18WarningModal } from '../components/Mature18WarningModal'
import { ChangeCoverModal } from '../components/ChangeCoverModal'
import { StoryDiscussionSection } from '../components/StoryDiscussionSection'
import type { ChapterListItem } from '@/types/chapter'

const formatCount = (n: number): string => {
  if (!n) return '0'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString('vi-VN')
}

const formatShortDate = (dateStr: string, now: number): string => {
  if (!Number.isFinite(new Date(dateStr).getTime())) return '—'
  const diff = now - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${Math.max(1, minutes)} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

interface LastReadInfo {
  storyId: string
  chapterId: string
  chapterNumber: number
  chapterTitle: string
}

export const StoryDetailPage: React.FC = () => {
  const renderClock = useContext(RenderClock)
  const [fallbackClock] = useState(() => renderClock || Date.now())
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: story, isLoading, error } = useStory(slug || '')
  const { isConfirmed: isMatureConfirmed, confirm: confirmMature } = useMatureConfirmation(story?._id ?? '')
  const [chapterSearch, setChapterSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const { data: chapters = [], isLoading: chaptersLoading, isError: chaptersError, refetch: retryChapters, hasNextPage, fetchNextPage, isFetchingNextPage } = useChapters(story?._id || '', { sort: sortOrder, q: chapterSearch })

  const { data: openingChapters = [] } = useChapters(story?._id || '', { sort: 'asc' })
  const { data: newestChapters = [] } = useChapters(story?._id || '', { sort: 'desc' })

  // Follow hooks
  const { data: followData } = useCheckFollow(story?._id || '')
  const { mutate: toggleFollow, isPending: isTogglingFollow } = useToggleFollow(story?._id || '')
  const isFollowing = !!followData?.isFollowing

  // 18+ Warning modal state
  const [showMature, setShowMature] = useState(false)
  const [pendingChapterSlug, setPendingChapterSlug] = useState<string | null>(null)

  const handleChapterClick = (e: React.MouseEvent, chapterSlug: string) => {
    if (story?.contentWarning === 'mature18+') {
      if (!isMatureConfirmed) {
        e.preventDefault()
        setPendingChapterSlug(chapterSlug)
        setShowMature(true)
        return
      }
    }
  }

  // Description expand/collapse
  const [isDescExpanded, setIsDescExpanded] = useState(false)

  // Change cover modal for author
  const [isChangeCoverOpen, setIsChangeCoverOpen] = useState(false)

  // Mobile sticky floating bar appears only after scrolling past the hero actions
  const [showStickyBar, setShowStickyBar] = useState(false)
  const heroActionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (heroActionsRef.current) {
        const rect = heroActionsRef.current.getBoundingClientRect()
        setShowStickyBar(rect.bottom < 80)
      } else {
        setShowStickyBar(window.scrollY > 360)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Reading history from localStorage
  const [lastRead, setLastRead] = useState<LastReadInfo | null>(null)
  const { data: resumeCandidates = [] } = useChapters(lastRead?.storyId === story?._id && /^[a-fA-F0-9]{24}$/.test(lastRead?.chapterId || '') ? story?._id || '' : '', { chapterId: lastRead?.chapterId })



  useEffect(() => {
    try {
      setLastRead(null)
      const raw = localStorage.getItem('novel_last_read')
      if (raw && story) {
        const parsed = JSON.parse(raw)
        if (parsed.storyId === story._id || parsed.storySlug === story.slug) {
          setLastRead(parsed)
        }
      }
    } catch {
      // Ignore localStorage parse error
    }
  }, [story])

  // Primary genre for related stories
  const primaryGenre = story?.genreIds?.[0]
  const primaryGenreId = typeof primaryGenre === 'object' ? primaryGenre._id : primaryGenre

  // Related stories query
  const { data: relatedData } = useStories({
    genre: primaryGenreId,
    limit: 6,
  })

  const relatedStories = useMemo(() => {
    if (!relatedData?.pages) return []
    const all = relatedData.pages.flatMap((p) => p.stories)
    return all.filter((s) => s._id !== story?._id).slice(0, 6)
  }, [relatedData, story?._id])

  // Filtered and sorted chapter list
  const filteredChapters = useMemo(() => {
    let list = [...chapters]
    if (chapterSearch.trim()) {
      const q = chapterSearch.toLowerCase().trim()
      list = list.filter(
        (c) => c.title.toLowerCase().includes(q) || c.order.toString().includes(q)
      )
    }

    return list
  }, [chapters, chapterSearch, sortOrder])

  // 5 Latest chapters for quick reading hook
  const latestFiveChapters = useMemo(() => {
    return newestChapters.slice(0, 5)
  }, [newestChapters])

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-card">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <Skeleton className="md:col-span-3 aspect-[2/3] w-48 mx-auto md:mx-0 rounded-none" />
              <div className="md:col-span-9 space-y-4">
                <Skeleton className="h-8 w-3/4 rounded-xl" />
                <Skeleton className="h-4 w-1/3 rounded-lg" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <div className="flex flex-wrap gap-3 pt-4">
                  <Skeleton className="h-11 w-36 rounded-full" />
                  <Skeleton className="h-11 w-36 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !story) {
    return (
      <AppLayout>
        <div className="flex min-h-[65vh] flex-col items-center justify-center px-4 text-center">
          <div className="h-20 w-20 rounded-full bg-secondary text-link flex items-center justify-center mb-4">
            <BookOpen className="h-10 w-10" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Không tìm thấy truyện</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Tác phẩm bạn đang tìm kiếm có thể đã bị gỡ hoặc đường dẫn không chính xác.
          </p>
          <Button asChild variant="default" className="mt-6 rounded-full px-6">
            <Link to="/stories">Khám phá tác phẩm khác</Link>
          </Button>
        </div>
      </AppLayout>
    )
  }

  const isMature = story.contentWarning === 'mature18+'
  const authorInfo = typeof story.authorId === 'object' ? story.authorId : null
  const attribution = storyAttribution(story)
  const authorDisplayName = attribution.author
  const authorIdVal = (authorInfo as any)?._id || (authorInfo as any)?.id || (typeof story.authorId === 'string' ? story.authorId : '')
  const authorStoriesLink = authorIdVal ? `/stories?author=${authorIdVal}` : `/stories?q=${encodeURIComponent(authorDisplayName)}`
  const isAuthor =
    user &&
    (authorInfo?._id === user.id ||
      authorInfo?.id === user.id ||
      (typeof story.authorId === 'string' && story.authorId === user.id))

  const statusLabel =
    story.status === 'completed' ? 'Hoàn thành' : story.status === 'hiatus' ? 'Tạm dừng' : 'Đang ra'
  const statusVariant = story.status === 'completed' ? ('success' as const) : ('secondary' as const)

  const firstChapter = openingChapters[0]
  const latestChapter: ChapterListItem | undefined = newestChapters[0]

  const resumeChapter = lastRead
    ? resumeCandidates.find((c) => c._id === lastRead.chapterId)
    : null

  const isLongDescription = (story.description?.length || 0) > 350

  return (
    <AppLayout showAds={story.moderationStatus === 'approved' && story.contentWarning === 'none'}>
      {/* 18+ Warning Banner */}
      {isMature && (
        <div className="bg-destructive/10 border-b border-destructive/20">
          <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8 flex items-center gap-2 text-xs sm:text-sm text-destructive font-medium">
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              18+
            </Badge>
            <span>Truyện này chứa nội dung dành cho người lớn. Cần xác nhận độ tuổi trước khi đọc.</span>
          </div>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div className="border-b border-border/40 bg-surface-raised/40">
        <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium truncate">
            <Link to="/" className="hover:text-link transition-colors shrink-0">
              Trang chủ
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
            <Link to="/stories" className="hover:text-link transition-colors shrink-0">
              Khám phá
            </Link>
            {primaryGenre && typeof primaryGenre === 'object' && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                <Link
                  to={`/stories?genre=${primaryGenre._id}`}
                  className="hover:text-link transition-colors shrink-0"
                >
                  {primaryGenre.name}
                </Link>
              </>
            )}
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
            <span className="text-foreground font-semibold truncate">{story.title}</span>
          </nav>
        </div>
      </div>

      {/* =========================================================================
          MAIN CONTAINER: 2 COLUMNS (8 COLS MAIN + 4 COLS SIDEBAR)
          Phong cách Mê Truyện Chữ / Truyenfull thanh lịch, trực quan, đọc liền mạch
          ========================================================================= */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-32 lg:pb-0">
          
          {/* =====================================================================
              LEFT 8 COLS: STORY INFO + GIỚI THIỆU + 5 CHƯƠNG MỚI + MỤC LỤC 3 CỘT
              ===================================================================== */}
          <div className="lg:col-span-8 space-y-6 min-w-0">

            {/* BLOCK 1: THÔNG TIN TRUYỆN CHÍNH (Card trên cùng) */}
            <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-card">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
                
                {/* Ảnh bìa 2:3 gọn gàng bên trái (180px–200px) */}
                <div className="sm:col-span-4 lg:col-span-4 flex justify-center sm:justify-start">
                  <div className="relative aspect-[2/3] w-44 sm:w-full max-w-[200px] overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-card">
                    {story.coverUrl ? (
                      <img
                        src={story.coverUrl}
                        alt={story.title}
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-secondary p-4 text-center">
                        <BookOpen className="h-12 w-12 text-link/40 mb-2" />
                        <span className="font-serif text-xs font-bold text-foreground line-clamp-3">
                          {story.title}
                        </span>
                      </div>
                    )}

                    {/* Badge trạng thái trên ảnh */}
                    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 pointer-events-none">
                      <Badge variant={statusVariant} className="text-[10px] shadow-xs backdrop-blur-md">
                        {statusLabel}
                      </Badge>
                      {isMature && (
                        <Badge variant="destructive" className="text-[9px] font-bold shadow-xs backdrop-blur-md">
                          18+
                        </Badge>
                      )}
                    </div>

                    {/* Nút Đổi ảnh bìa cho Tác giả */}
                    {isAuthor && (
                      <button
                        type="button"
                        onClick={() => setIsChangeCoverOpen(true)}
                        className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-md hover:bg-black/90 hover:scale-105 transition-all cursor-pointer"
                        title="Đổi ảnh bìa truyện"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>Đổi bìa</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Thông tin chi tiết bên phải ảnh */}
                <div className="min-w-0 sm:col-span-8 lg:col-span-8 flex flex-col justify-between space-y-3">
                  <div>
                    {/* Tên truyện */}
                    <h1 className="break-words font-serif text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground leading-snug">
                      {story.title}
                    </h1>

                    {/* Meta List dạng bảng gọn gàng */}
                    <div className="mt-3 space-y-2 text-xs sm:text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">Tác giả:</span>
                        <>{attribution.isCollected ? <span className="font-semibold">{authorDisplayName}</span> : <Link
                          to={authorStoriesLink}
                          className="font-semibold text-link hover:underline transition-colors inline-flex items-center gap-1"
                        >
                          <User className="h-3.5 w-3.5" />
                          {authorDisplayName}
                        </Link>}</>
                      </div>

                      {attribution.isCollected && <div className="flex items-start gap-2"><span className="text-muted-foreground w-20 shrink-0">Nguồn:</span><span className="break-all">{attribution.source}</span></div>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground w-20 shrink-0">Thể loại:</span>
                        <div className="min-w-0 flex flex-1 flex-wrap gap-1.5">
                          {story.genreIds?.map((g) => (
                            <Link key={g._id} to={`/stories?genre=${g._id}`}>
                              <span className="inline-block rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-link hover:bg-primary/20 transition-colors">
                                {g.name}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">Tình trạng:</span>
                        <Badge variant={statusVariant} className="text-xs font-semibold">
                          {statusLabel}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">Đánh giá:</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${
                                  i < Math.round(story.ratingAverage || 5)
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-border'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-bold text-foreground">
                            {story.ratingAverage > 0 ? story.ratingAverage.toFixed(1) : '5.0'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            / 5 ({story.ratingCount || 0} lượt)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dải thống kê 4 ô nhỏ gọn */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border/60 text-center">
                      <div className="rounded-xl bg-surface-raised p-2">
                        <div className="text-[11px] text-muted-foreground">Số chương</div>
                        <div className="font-bold text-foreground text-xs sm:text-sm mt-0.5">
                          {story.chapterCount || chapters.length}
                        </div>
                      </div>
                      <div className="rounded-xl bg-surface-raised p-2">
                        <div className="text-[11px] text-muted-foreground">Lượt đọc</div>
                        <div className="font-bold text-foreground text-xs sm:text-sm mt-0.5">
                          {formatCount(story.viewCount)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-surface-raised p-2">
                        <div className="text-[11px] text-muted-foreground">Theo dõi</div>
                        <div className="font-bold text-foreground text-xs sm:text-sm mt-0.5">
                          {formatCount(story.followCount)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Thanh nút hành động chính (CTAs) */}
                  <div ref={heroActionsRef} className="flex flex-wrap items-center gap-2.5 pt-3">
                    {/* Nút Đọc chính */}
                    {resumeChapter ? (
                      <Button
                        asChild
                        variant="default"
                        size="default"
                        className="rounded-full font-bold px-6 shadow-sm shadow-primary/25"
                      >
                        <Link
                          to={`/stories/${story.slug}/chapters/chuong-${resumeChapter.order}`}
                          onClick={(e) => handleChapterClick(e, resumeChapter.slug)}
                        >
                          <BookOpen className="h-4 w-4 mr-1.5" />
                          Đọc Tiếp C.{resumeChapter.order}
                        </Link>
                      </Button>
                    ) : firstChapter ? (
                      <Button
                        asChild
                        variant="default"
                        size="default"
                        className="rounded-full font-bold px-6 shadow-sm shadow-primary/25"
                      >
                        <Link
                          to={`/stories/${story.slug}/chapters/chuong-${firstChapter.order}`}
                          onClick={(e) => handleChapterClick(e, firstChapter.slug)}
                        >
                          <BookOpen className="h-4 w-4 mr-1.5" />
                          Đọc Từ Đầu
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="default" size="default" className="rounded-full opacity-50 px-6" disabled>
                        <BookOpen className="h-4 w-4 mr-1.5" />
                        Chưa có chương
                      </Button>
                    )}

                    {/* Nút Theo Dõi */}
                    <Button
                      variant={isFollowing ? 'secondary' : 'outline'}
                      size="default"
                      className={`rounded-full font-semibold px-4 transition-all ${
                        isFollowing
                          ? 'bg-secondary text-link border-primary/40 shadow-xs'
                          : 'hover:border-primary hover:text-link'
                      }`}
                      onClick={() => toggleFollow()}
                      disabled={isTogglingFollow}
                    >
                      <Heart
                        className={`h-4 w-4 mr-1.5 transition-transform active:scale-125 ${
                          isFollowing ? 'fill-primary text-link' : 'text-link'
                        }`}
                      />
                      {isFollowing ? 'Đang Theo Dõi' : 'Theo Dõi'}
                    </Button>

                    {/* Tác giả quản lý */}
                    {isAuthor && (
                      <Button
                        asChild
                        variant="secondary"
                        size="default"
                        className="rounded-full text-link font-semibold ml-auto"
                      >
                        <Link to={`/author/stories/${story._id}/chapters`}>
                          <PenTool className="h-4 w-4 mr-1.5" />
                          Quản Lý
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* =================================================================
                PHẦN 1: GIỚI THIỆU TRUYỆN
                ================================================================= */}
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-card space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <FileText className="h-5 w-5 text-link" />
                <h2 className="font-serif text-lg sm:text-xl font-bold text-foreground">
                  Giới Thiệu Truyện
                </h2>
              </div>

              <div className="relative">
                <div
                  className={`prose prose-sm max-w-none text-foreground leading-relaxed whitespace-pre-line font-sans ${
                    !isDescExpanded && isLongDescription ? 'max-h-44 overflow-hidden' : ''
                  }`}
                >
                  {descriptionWithSourceName(story.description || '') || (
                    <p className="italic text-muted-foreground">
                      Tác giả chưa cập nhật phần tóm tắt cho tác phẩm này.
                    </p>
                  )}
                </div>

                {!isDescExpanded && isLongDescription && (
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                )}
              </div>

              {isLongDescription && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    aria-expanded={isDescExpanded}
                    className="inline-flex items-center gap-1 text-xs font-bold text-link hover:underline cursor-pointer"
                  >
                    {isDescExpanded ? (
                      <>
                        <span>Thu gọn giới thiệu</span>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Xem toàn bộ giới thiệu</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Tag Cloud */}
              {story.tagIds && story.tagIds.length > 0 && (
                <div className="pt-3 border-t border-border/50 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
                    <Tag className="h-3 w-3" /> Từ khóa:
                  </span>
                  {story.tagIds.map((t) => (
                    <span
                      key={t._id}
                      className="inline-block rounded-full bg-surface-raised border border-border-subtle px-2.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      #{t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* =================================================================
                PHẦN 2: PHẦN CHƯƠNG (Gồm 2.1 Chương Mới Nhất & 2.2 Danh Sách Chương)
                ================================================================= */}
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-card space-y-6">
              
              {/* PHẦN 2.1: CHƯƠNG MỚI NHẤT */}
              {latestFiveChapters.length > 0 && (
                <div className="rounded-2xl border border-primary/20 bg-secondary/35 p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 pb-2.5">
                    <div className="flex items-center gap-2 text-link font-bold text-xs sm:text-sm uppercase tracking-wider">
                      <Clock className="h-4 w-4" />
                      <span>Chương Mới Nhất</span>
                    </div>
                    {latestChapter && (
                      <span className="text-xs text-muted-foreground font-medium">
                        Cập nhật đến Chương {latestChapter.order}
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-border/40">
                    {latestFiveChapters.map((chap) => (
                      <Link
                        key={chap._id}
                        to={`/stories/${story.slug}/chapters/chuong-${chap.order}`}
                        onClick={(e) => handleChapterClick(e, chap.slug)}
                        className="group flex items-center justify-between py-2 px-1 hover:text-link transition-colors text-xs sm:text-sm"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="font-semibold text-foreground group-hover:text-link shrink-0">
                            Chương {chap.order}:
                          </span>
                          <span className="truncate text-muted-foreground group-hover:text-link">
                            {chap.title}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0 ml-2 group-hover:text-link">
                          {formatShortDate(chap.createdAt, renderClock || fallbackClock)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* PHẦN 2.2: DANH SÁCH TOÀN BỘ CHƯƠNG */}
              <div className="space-y-4 pt-2">
                {/* Header Mục Lục + Tìm kiếm + Sắp xếp */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ListOrdered className="h-5 w-5 text-link" />
                    <h2 className="font-serif text-lg sm:text-xl font-bold text-foreground">
                      Danh Sách Chương
                    </h2>
                    <Badge variant="secondary" className="font-semibold text-xs ml-1">
                      Đã tải {chapters.length} chương
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Tìm kiếm chương */}
                    <div className="relative w-full sm:w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        aria-label="Tìm số hoặc tên chương"
                        placeholder="Tìm số/tên chương..."
                        value={chapterSearch}
                        onChange={(e) => setChapterSearch(e.target.value)}
                        className="w-full rounded-full border border-border bg-surface-base pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                      />
                    </div>

                    {/* Đảo chiều sắp xếp */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs font-semibold shrink-0"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      title={sortOrder === 'asc' ? 'Đang xếp: Cũ nhất trước' : 'Đang xếp: Mới nhất trước'}
                    >
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-link" />
                      {sortOrder === 'asc' ? '1 → N' : 'N → 1'}
                    </Button>

                    {isAuthor && (
                      <Button asChild variant="default" size="sm" className="rounded-full shrink-0">
                        <Link to={`/author/stories/${story._id}/chapters/new`}>+ Thêm</Link>
                      </Button>
                    )}
                  </div>
                </div>

                {hasNextPage && <Button disabled={isFetchingNextPage} onClick={() => { void fetchNextPage() }}>Tải thêm chương</Button>}
                {/* Lưới 3 Cột Chương (Desktop: 3 cột, Tablet: 2 cột, Mobile: 1 cột) */}
                {chaptersError ? <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-center text-sm"><p>Không thể tải danh sách chương.</p><Button variant="outline" size="sm" onClick={() => { void retryChapters() }} className="mt-3">Thử lại</Button></div> : chaptersLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 rounded-lg" />
                    ))}
                  </div>
                ) : filteredChapters.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                    {filteredChapters.map((chap) => {
                      const isCurrentReading =
                        lastRead &&
                        (lastRead.chapterId === chap._id || lastRead.chapterNumber === chap.order)

                      return (
                        <Link
                          key={chap._id}
                          to={`/stories/${story.slug}/chapters/chuong-${chap.order}`}
                          onClick={(e) => handleChapterClick(e, chap.slug)}
                          className={`group flex items-center justify-between py-2 px-2 rounded-lg transition-colors text-xs border-b border-border/30 hover:border-primary/40 ${
                            isCurrentReading
                              ? 'bg-secondary text-link font-bold'
                              : 'hover:bg-surface-raised text-foreground/90'
                          }`}
                          title={`Đọc Chương ${chap.order}: ${chap.title}`}
                        >
                          <span className="truncate group-hover:text-link group-hover:underline transition-colors font-medium">
                            Chương {chap.order}: {chap.title}
                          </span>
                          {isCurrentReading && (
                            <span className="rounded bg-primary/20 text-link px-1 py-0.2 text-[9px] font-bold shrink-0 ml-1">
                              Đang đọc
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm space-y-2">
                    <BookOpen className="h-10 w-10 mx-auto text-link/30" />
                    <p>
                      {chapterSearch
                        ? 'Không tìm thấy chương phù hợp với từ khóa.'
                        : 'Tác giả chưa đăng chương nào cho tác phẩm này.'}
                    </p>
                  </div>
                )}
              </div>

            </div>

            {/* BLOCK 5: ĐÁNH GIÁ & BÌNH LUẬN BẠN ĐỌC */}
            <StoryDiscussionSection
              storyId={story._id}
              storyTitle={story.title}
              storyAuthorId={authorInfo?._id}
              ratingAverage={story.ratingAverage}
              ratingCount={story.ratingCount}
            />

          </div>

          {/* =====================================================================
              RIGHT 4 COLS: SIDEBAR (THÔNG TIN TÁC GIẢ + TRUYỆN CÙNG THỂ LOẠI)
              ===================================================================== */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* WIDGET 1: THÔNG TIN TÁC GIẢ */}
            {authorInfo && !attribution.isCollected && (
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                  Tác Giả
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="h-14 w-14 rounded-full bg-secondary text-link flex items-center justify-center text-lg font-bold overflow-hidden border border-border shadow-xs shrink-0">
                    {authorInfo.avatarUrl ? (
                      <img
                        src={authorInfo.avatarUrl}
                        alt={authorDisplayName}
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      authorDisplayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground truncate text-sm sm:text-base">
                      {authorDisplayName}
                    </h3>
                    <span className="inline-block mt-1 rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-link">
                      Tác Giả iutruyen
                    </span>
                  </div>
                </div>

                {authorInfo.bio && (
                  <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                    {authorInfo.bio}
                  </p>
                )}

                <div className="pt-2 border-t border-border/50">
                  <Link
                    to={authorStoriesLink}
                    className="flex items-center justify-between text-xs font-bold text-link hover:underline"
                  >
                    <span>Xem các tác phẩm khác</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* WIDGET 2: TRUYỆN CÙNG THỂ LOẠI ĐỀ CỬ */}
            {relatedStories.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-link" />
                    Cùng Thể Loại
                  </span>
                  {primaryGenreId && (
                    <Link
                      to={`/stories?genre=${primaryGenreId}`}
                      className="text-xs font-bold text-link hover:underline"
                    >
                      Xem thêm
                    </Link>
                  )}
                </div>

                <div className="space-y-3">
                  {relatedStories.map((relStory) => {
                    return (
                      <Link
                        key={relStory._id}
                        to={`/stories/${relStory.slug}`}
                        className="flex items-center gap-3 p-2 rounded-2xl hover:bg-surface-raised transition-all group"
                      >
                        {/* Ảnh bìa thumbnail nhỏ */}
                        <div className="h-16 w-11 shrink-0 overflow-hidden rounded-none border border-border bg-surface-raised shadow-xs">
                          {relStory.coverUrl ? (
                            <img
                              src={relStory.coverUrl}
                              alt={relStory.title}
                              className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-secondary text-link">
                              <BookOpen className="h-4 w-4" />
                            </div>
                          )}
                        </div>

                        {/* Thông tin truyện */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-serif text-xs font-bold text-foreground group-hover:text-link transition-colors line-clamp-1">
                            {relStory.title}
                          </h4>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {storyAttribution(relStory).author}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                            <span>{relStory.chapterCount || 0} chương</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Eye className="h-2.5 w-2.5 text-link" />
                              {formatCount(relStory.viewCount)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* WIDGET 3: QUYỀN LỢI ĐỌC TẠI IUTRUYEN */}
            <div className="rounded-3xl border border-border/80 bg-surface-raised/40 p-5 space-y-2 text-xs text-muted-foreground">
              <div className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-link" />
                Đọc Truyện Tại iutruyen
              </div>
              <p className="leading-relaxed text-[11px]">
                Nền tảng đọc truyện chữ bản quyền mượt mà, tối ưu phông chữ chống mỏi mắt và tự động lưu tiến độ đọc trên mọi thiết bị.
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* =========================================================================
          MOBILE FLOATING READ BAR (Nổi ở đáy trên Mobile, tính toán không đè Navbar)
          ========================================================================= */}
      <div
        className={`fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 lg:hidden border-t border-border bg-card/95 backdrop-blur-lg p-2.5 z-40 shadow-elevated transition-all duration-300 ${
          showStickyBar ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2">
          {resumeChapter ? (
            <Button
              asChild
              variant="default"
              className="flex-1 rounded-full font-bold shadow-xs py-2 text-xs"
            >
              <Link
                to={`/stories/${story.slug}/chapters/chuong-${resumeChapter.order}`}
                onClick={(e) => handleChapterClick(e, resumeChapter.slug)}
              >
                <BookOpen className="h-4 w-4 mr-1.5" />
                Đọc Tiếp C.{resumeChapter.order}
              </Link>
            </Button>
          ) : firstChapter ? (
            <Button
              asChild
              variant="default"
              className="flex-1 rounded-full font-bold shadow-xs py-2 text-xs"
            >
              <Link
                to={`/stories/${story.slug}/chapters/chuong-${firstChapter.order}`}
                onClick={(e) => handleChapterClick(e, firstChapter.slug)}
              >
                <BookOpen className="h-4 w-4 mr-1.5" />
                Đọc Từ Đầu
              </Link>
            </Button>
          ) : (
            <Button variant="default" className="flex-1 opacity-50 rounded-full font-semibold" disabled>
              <BookOpen className="h-4 w-4 mr-1.5" />
              Chưa có chương
            </Button>
          )}

          <Button
            variant={isFollowing ? 'secondary' : 'outline'}
            className="rounded-full px-3.5"
            onClick={() => toggleFollow()}
            disabled={isTogglingFollow}
            aria-label={isFollowing ? 'Hủy theo dõi truyện' : 'Theo dõi truyện'}
            aria-pressed={isFollowing}
          >
            <Heart
              className={`h-4 w-4 ${
                isFollowing ? 'fill-primary text-link' : 'text-link'
              }`}
            />
          </Button>
        </div>
      </div>

      {/* Mature 18+ Confirmation Dialog */}
      <Mature18WarningModal
        open={showMature}
        onConfirm={() => {
          setShowMature(false)
          if (story) {
            confirmMature()
            if (pendingChapterSlug) {
              navigate(`/stories/${story.slug}/chapters/${pendingChapterSlug}`)
              setPendingChapterSlug(null)
            }
          }
        }}
        onCancel={() => {
          setShowMature(false)
          setPendingChapterSlug(null)
        }}
      />

      {/* Change Story Cover Modal for Author */}
      {isAuthor && story && (
        <ChangeCoverModal
          story={story}
          open={isChangeCoverOpen}
          onClose={() => setIsChangeCoverOpen(false)}
        />
      )}
    </AppLayout>
  )
}

export default StoryDetailPage
