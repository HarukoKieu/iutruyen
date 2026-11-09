import React from 'react'
import { X, MessageSquare } from 'lucide-react'
import { CommentList } from '@/features/comments/components/CommentList'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'

interface ChapterCommentsDrawerProps {
  isOpen: boolean
  onClose: () => void
  storyId: string
  chapterId: string
  chapterTitle: string
  storyAuthorId?: string
}

export const ChapterCommentsDrawer: React.FC<ChapterCommentsDrawerProps> = ({
  isOpen,
  onClose,
  storyId,
  chapterId,
  chapterTitle,
  storyAuthorId,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  useModalAccessibility({ open: isOpen, onClose, containerRef: dialogRef })
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/40 backdrop-blur-2xs animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div data-modal-backdrop aria-hidden="true" className="absolute inset-0" onClick={onClose} />

      {/* Drawer panel */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-lg min-w-0 h-dvh bg-card border-l border-border shadow-elevated flex flex-col animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-surface-raised/50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-secondary text-link flex items-center justify-center shrink-0">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="font-serif text-sm sm:text-base font-bold text-foreground truncate">
                Bình Luận Chương
              </h2>
              <p className="text-xs text-muted-foreground truncate">{chapterTitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bình luận chương"
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body - Scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <CommentList
            storyId={storyId}
            chapterId={chapterId}
            chapterTitle={chapterTitle}
            storyAuthorId={storyAuthorId}
          />
        </div>
      </div>
    </div>
  )
}
