import type { ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChapterNavInfo } from '@/types/chapter'
import { TableOfContentsDropdown } from './TableOfContentsDropdown'

type ChapterNavigationProps = Omit<ComponentProps<typeof TableOfContentsDropdown>, 'placement'> & {
  prevChapter: ChapterNavInfo | null
  nextChapter: ChapterNavInfo | null
  onOpenComments: () => void
  position?: 'top' | 'bottom'
}

export function ChapterNavigation({
  prevChapter, nextChapter, onOpenComments, position = 'bottom', ...tocProps
}: ChapterNavigationProps) {
  const buttonClass = 'h-10 rounded-full bg-card px-3.5 sm:px-5 text-foreground text-xs font-semibold shadow-xs hover:bg-surface-raised hover:border-primary/40 hover:text-link transition-colors'

  return (
    <nav
      aria-label={position === 'top' ? 'Điều hướng đầu chương' : 'Điều hướng cuối chương'}
      className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4 ${position === 'top' ? 'mb-8' : 'mt-16 border-t border-border pt-8'}`}
    >
      <div className="min-w-0 justify-self-start">
        {prevChapter ? (
          <Button asChild variant="outline" className={buttonClass}>
            <Link to={`/stories/${tocProps.storySlug}/chapters/chuong-${prevChapter.order}`}>
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Trước
            </Link>
          </Button>
        ) : (
          <Button variant="outline" className={`${buttonClass} opacity-50`} disabled>
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            Trước
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <TableOfContentsDropdown
          key={tocProps.currentChapterId}
          {...tocProps}
          placement={position === 'top' ? 'bottom' : 'top'}
        />
        <button
          type="button"
          onClick={onOpenComments}
          title="Bình luận"
          aria-label="Bình luận"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border-0 bg-card text-foreground shadow-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MessageSquare className="h-5 w-5 text-link" aria-hidden="true" />
        </button>
      </div>

      <div className="min-w-0 justify-self-end">
        {nextChapter ? (
          <Button asChild variant="outline" className={buttonClass}>
            <Link to={`/stories/${tocProps.storySlug}/chapters/chuong-${nextChapter.order}`}>
              Sau
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" className={`${buttonClass} opacity-50`} disabled>
            Sau
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </nav>
  )
}
