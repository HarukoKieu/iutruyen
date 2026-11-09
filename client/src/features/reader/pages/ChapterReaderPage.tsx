import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ChevronRight,
  ArrowLeft,
  ShieldAlert,
  Calendar,
  Eye,
  Flag,
} from 'lucide-react'
import { useChapterDetail } from '@/features/chapters/hooks/useChapterDetail'
import { useChapters } from '@/features/chapters/hooks/useChapters'
import { useUpsertReadingHistory } from '@/features/follows-bookmarks/hooks/useReadingHistory'
import { useReaderSettingsStore } from '@/features/reader-settings/store/readerSettingsStore'
import { ReaderToolbar } from '../components/ReaderToolbar'
import { ChapterNavigation } from '../components/ChapterNavigation'
import { ReaderSettingsModal } from '../components/ReaderSettingsModal'
import { ChapterCommentsDrawer } from '../components/ChapterCommentsDrawer'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Mature18WarningModal } from '@/features/stories/components/Mature18WarningModal'
import AdSlot from '@/components/common/AdSlot'
import { useMatureConfirmation } from '@/features/stories/hooks/useMatureConfirmation'
import { useReadingProgress } from '../hooks/useReadingProgress'
import ReportModal from '@/features/moderation/components/ReportModal'
import { useAuthStore } from '@/features/auth/store/authStore'

export const ChapterReaderPage: React.FC = () => {
  const { slug, chapterSlug } = useParams<{ slug: string; chapterSlug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [reportChapterId, setReportChapterId] = useState<string | null>(null)
  const [tocSearch, setTocSearch] = useState('')
  const [tocQuery, setTocQuery] = useState('')
  const [isToolbarVisible, setIsToolbarVisible] = useState(true)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error } = useChapterDetail(slug || '', chapterSlug || '')
  const isReportOpen = !!reportChapterId && reportChapterId === data?.chapter?._id
  const openReport = () => {
    if (!isAuthenticated) {
      toast.info('Vui lòng đăng nhập để báo cáo vấn đề.')
      navigate('/login', { state: { from: location } })
      return
    }
    if (data?.chapter) setReportChapterId(data.chapter._id)
  }
  useEffect(() => {
    if (data?.chapter && slug && chapterSlug !== `chuong-${data.chapter.order}`) {
      navigate(`/stories/${slug}/chapters/chuong-${data.chapter.order}`, { replace: true })
    }
  }, [data?.chapter, slug, chapterSlug, navigate])
  const storyId = data?.story?._id || ''
  const { isConfirmed: isMatureConfirmed, confirm: confirmMature } = useMatureConfirmation(storyId)

  useEffect(() => {
    const timer = setTimeout(() => setTocQuery(tocSearch.trim()), 250)
    return () => clearTimeout(timer)
  }, [tocSearch])
  const { data: allChapters = [], hasNextPage, fetchNextPage, isFetchingNextPage, isLoading: chaptersLoading, isError: chaptersError, refetch: refetchChapters } = useChapters(storyId, { q: tocQuery || undefined })

  // Derive the gate synchronously so fetched mature content never starts unguarded.
  const showMatureModal = data?.story?.contentWarning === 'mature18+' && !isMatureConfirmed
  const { readingProgress, progressReady } = useReadingProgress(data?.chapter?._id || '', !isLoading && !error && !showMatureModal)
  const {
    fontFamily,
    fontSize,
    lineHeight,
    containerWidth,
    textAlign,
  } = useReaderSettingsStore()

  // Auto-hide toolbar 3s after scrolling starts, show again on mouse move / touch
  useEffect(() => {
    const showToolbar = () => {
      setIsToolbarVisible(true)
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current)
      toolbarTimerRef.current = setTimeout(() => {
        if (!toolbarRef.current?.contains(document.activeElement)) setIsToolbarVisible(false)
      }, 3000)
    }

    const handleMouseMove = () => showToolbar()
    const handleTouchStart = () => showToolbar()
    let previousScroll = window.scrollY
    const handleScroll = () => {
      if (window.scrollY < previousScroll) showToolbar()
      previousScroll = window.scrollY
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })
    // Show toolbar initially for 3s
    showToolbar()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('scroll', handleScroll)
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current)
    }
  }, [])

  const { mutate: upsertHistory } = useUpsertReadingHistory()
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced sync reading history with scrollPositionPercent to server
  useEffect(() => {
    if (!progressReady || !data?.story?._id || !data?.chapter?._id) return

    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current)
    }

    historyDebounceRef.current = setTimeout(() => {
      upsertHistory({
        storyId: data.story._id,
        lastChapterId: data.chapter._id,
        scrollPositionPercent: readingProgress,
      })
    }, 2000)

    return () => {
      if (historyDebounceRef.current) {
        clearTimeout(historyDebounceRef.current)
      }
    }
  }, [progressReady, readingProgress, data?.story?._id, data?.chapter?._id, upsertHistory])

  // Auto save to localStorage for ContinueReadingRibbon on Homepage
  useEffect(() => {
    if (progressReady && data?.story && data?.chapter) {
      try {
        const total = data.story.chapterCount || allChapters.length || 1
        const percent = Math.min(Math.round(((data.chapter.order || 1) / total) * 100), 100)
        const historyItem = {
          storyId: data.story._id,
          storySlug: data.story.slug,
          storyTitle: data.story.title,
          chapterId: data.chapter._id,
          chapterNumber: data.chapter.order,
          chapterTitle: data.chapter.title,
          totalChapters: total,
          progressPercent: percent,
          scrollPositionPercent: readingProgress,
          lastReadAt: new Date().toISOString(),
        }
        localStorage.setItem('novel_last_read', JSON.stringify(historyItem))
      } catch {
        // Ignore localStorage error
      }
    }
  }, [progressReady, data, allChapters, readingProgress])

  // Keyboard navigation: Left Arrow (Prev), Right Arrow (Next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isSettingsOpen || isCommentsOpen || isReportOpen || showMatureModal || target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"], [role="menu"]')) return

      if (e.key === 'ArrowLeft' && data?.prevChapter) {
        e.preventDefault()
        navigate(`/stories/${slug}/chapters/chuong-${data.prevChapter.order}`)
      } else if (e.key === 'ArrowRight' && data?.nextChapter) {
        e.preventDefault()
        navigate(`/stories/${slug}/chapters/chuong-${data.nextChapter.order}`)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [data, slug, navigate, isSettingsOpen, isCommentsOpen, isReportOpen, showMatureModal])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <div className="h-14 border-b border-border bg-card animate-pulse" />
        <div className="mx-auto w-full max-w-2xl px-4 py-12 space-y-6 flex-1">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/3 mx-auto" />
          <div className="space-y-4 pt-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !data?.chapter) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-border bg-card p-8 text-center shadow-card space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mx-auto">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="font-serif text-xl font-bold">Chương chưa phát hành hoặc không tồn tại</h2>
          <p className="text-xs text-muted-foreground">
            Chương này có thể đang ở trạng thái bản thảo hoặc chưa đến giờ công bố.
          </p>
          <div className="pt-2">
            <Button asChild variant="default" className="rounded-full">
              <Link to={`/stories/${slug}`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Về Trang Chi Tiết Truyện
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const { chapter, story, prevChapter, nextChapter } = data
  const chapterTitle = /^chương\s+\d+/i.test(chapter.title.trim())
    ? chapter.title
    : `Chương ${chapter.order}: ${chapter.title}`
  const primaryGenre = story.genreIds?.[0]
  const canShowAds = story.moderationStatus === 'approved'
    && chapter.status === 'published'
    && chapter.moderationStatus === 'approved'
    && story.contentWarning === 'none'

  const navigationProps = {
    prevChapter,
    nextChapter,
    chapters: allChapters,
    currentChapterId: chapter._id,
    storySlug: story.slug,
    hasMore: hasNextPage,
    loading: chaptersLoading || tocSearch.trim() !== tocQuery,
    error: chaptersError,
    loadingMore: isFetchingNextPage,
    onLoadMore: () => { void fetchNextPage() },
    onRetry: () => { void refetchChapters() },
    searchQuery: tocSearch,
    onSearch: setTocSearch,
    onOpenComments: () => setIsCommentsOpen(true),
  }

  // Container width class
  const getContainerWidthClass = () => {
    if (containerWidth === 'narrow') return 'max-w-[660px]'
    if (containerWidth === 'wide') return 'max-w-[840px]'
    return 'max-w-[740px]'
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Sticky Top Reading Progress Track */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent">
        <div
          className="h-full bg-primary transition-all duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Floating Reader Toolbar — auto-hide */}
      <div ref={toolbarRef} onFocusCapture={() => setIsToolbarVisible(true)} className={`sticky top-0 z-40 transition-opacity duration-300 focus-within:opacity-100 focus-within:pointer-events-auto ${isToolbarVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <ReaderToolbar
          storyId={story._id}
          chapterId={chapter._id}
          storyTitle={story.title}
          storySlug={story.slug}
          chapterTitle={chapterTitle}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenComments={() => setIsCommentsOpen(true)}
          onOpenReport={openReport}
        />
      </div>

      <nav aria-label="Đường dẫn trang" className="border-b border-border/40 bg-surface-raised/40">
        <ol className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <li><Link to="/" className="hover:text-link">Trang chủ</Link></li>
          <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
          <li><Link to="/stories" className="hover:text-link">Khám phá</Link></li>
          {primaryGenre && (
            <>
              <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
              <li><Link to={`/stories?genre=${primaryGenre._id || primaryGenre.slug}`} className="hover:text-link">{primaryGenre.name}</Link></li>
            </>
          )}
          <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
          <li><Link to={`/stories/${story.slug}`} className="hover:text-link">{story.title}</Link></li>
          <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
          <li aria-current="page" className="font-semibold text-foreground">Chương {chapter.order}</li>
        </ol>
      </nav>

      {/* Main Chapter Content Container */}
      <main className="mx-auto px-4 sm:px-6 py-8 sm:py-14">
        {canShowAds && <AdSlot placement="reader-top" className={`${getContainerWidthClass()} mb-8`} />}
        <article className={`mx-auto ${getContainerWidthClass()}`}>
          {/* Chapter Header */}
          <header className="text-center pb-8 mb-8 border-b border-border/60 space-y-2">
            <Link
              to={`/stories/${story.slug}`}
              className="text-xs uppercase tracking-widest font-bold text-link hover:underline transition-colors"
            >
              {story.title}
            </Link>

            <h1 className="break-words font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
              {chapterTitle}
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(chapter.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {chapter.viewCount || 0} lượt đọc
              </span>
            </div>
          </header>

          <ChapterNavigation {...navigationProps} position="top" />

          {/* Chapter Body Html */}
          <div
            ref={contentRef}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              fontFamily:
                fontFamily === 'serif'
                  ? "var(--font-serif, 'Newsreader', 'Lora', Georgia, serif)"
                  : "var(--font-sans, 'Plus Jakarta Sans', sans-serif)",
              textAlign: textAlign,
            }}
            className={`reader-container max-w-none text-current leading-relaxed transition-all duration-150 ${
              showMatureModal ? 'select-none filter blur-md pointer-events-none' : ''
            }`}
            dangerouslySetInnerHTML={{ __html: chapter.contentHtml }}
          />

          {/* Bottom Chapter Navigation */}
          <ChapterNavigation {...navigationProps} />

          <div className="mt-6 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">Phát hiện lỗi hoặc nội dung không phù hợp trong chương?</p>
            <Button variant="outline" className="gap-2 rounded-full" onClick={openReport} aria-haspopup="dialog">
              <Flag className="h-4 w-4" aria-hidden="true" />
              Báo cáo vấn đề
            </Button>
          </div>
        </article>
        {canShowAds && <AdSlot placement="reader-bottom" className={`${getContainerWidthClass()} mt-12`} />}
      </main>

      {/* Reader Settings Modal */}
      {isReportOpen && (
        <ReportModal
          isOpen
          targetType="chapter"
          targetId={chapter._id}
          targetTitle={`${story.title} — ${chapterTitle}`}
          onClose={() => setReportChapterId(null)}
        />
      )}

      <ReaderSettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Chapter Comments Drawer */}
      <ChapterCommentsDrawer
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        storyId={story._id}
        chapterId={chapter._id}
        chapterTitle={chapterTitle}
        storyAuthorId={typeof story.authorId === 'object' ? (story.authorId as any)._id : story.authorId}
      />

      {/* Mature 18+ Confirmation Dialog */}
      <Mature18WarningModal
        open={showMatureModal}
        onConfirm={confirmMature}
        onCancel={() => {
          navigate(`/stories/${slug}`)
        }}
      />
    </div>
  )
}

export default ChapterReaderPage
