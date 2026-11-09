import React, { useState } from 'react'
import { MessageSquare, Flame, Clock } from 'lucide-react'
import { useComments } from '../hooks/useComments'
import { useCommentMutations } from '../hooks/useCommentMutations'
import { CommentBox } from './CommentBox'
import { CommentItem } from './CommentItem'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface CommentListProps {
  storyId: string
  chapterId?: string | null
  chapterTitle?: string
  storyAuthorId?: string
}

export const CommentList: React.FC<CommentListProps> = ({
  storyId,
  chapterId,
  chapterTitle,
  storyAuthorId,
}) => {
  const [sort, setSort] = useState<'newest' | 'top'>('newest')

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useComments({
    storyId,
    chapterId,
    sort,
    limit: 15,
  })

  const {
    createComment,
    isCreating,
    updateComment,
    deleteComment,
    toggleLike,
    toggleLock,
  } = useCommentMutations(storyId, chapterId)

  const comments = data?.pages.flatMap((page) => page.items) ?? []

  const handleCreateComment = async (content: string) => {
    await createComment(content)
  }

  return (
    <div className="space-y-5">
      {/* Post Comment Input Box */}
      <CommentBox
        onSubmit={handleCreateComment}
        isLoading={isCreating}
        chapterTitle={chapterTitle}
      />

      {/* Sort & Count Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-link" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            {chapterId ? 'Bình Luận Chương' : 'Bình Luận Tác Phẩm'}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-link">
            {comments.length}
          </span>
        </div>

        {/* Sort toggle buttons */}
        <div className="flex items-center gap-1 bg-surface-raised p-0.5 rounded-full border border-border/50 text-[11px]">
          <button
            type="button"
            onClick={() => setSort('newest')}
            aria-pressed={sort === 'newest'}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-all cursor-pointer ${
              sort === 'newest'
                ? 'bg-card text-link shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="h-3 w-3" />
            Mới nhất
          </button>
          <button
            type="button"
            onClick={() => setSort('top')}
            aria-pressed={sort === 'top'}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-all cursor-pointer ${
              sort === 'top'
                ? 'bg-card text-link shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Flame className="h-3 w-3" />
            Nổi bật
          </button>
        </div>
      </div>

      {/* Comments List Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-center text-xs text-destructive">
          Không thể tải danh sách bình luận. Vui lòng thử lại sau.
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              storyAuthorId={storyAuthorId}
              onLike={async (id) => {
                await toggleLike(id)
              }}
              onDelete={async (id) => {
                await deleteComment({ id })
              }}
              onUpdate={async (id, newContent) => {
                await updateComment({ id, content: newContent })
              }}
              onToggleLock={async (id) => {
                await toggleLock({ id })
              }}
              onReply={async (parentId, replyContent) => {
                await createComment(replyContent, parentId)
              }}
            />
          ))}

          {/* Load More Button */}
          {hasNextPage && (
            <div className="pt-2 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                isLoading={isFetchingNextPage}
                className="rounded-full px-6 text-xs font-semibold"
              >
                Xem thêm bình luận cũ hơn
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="py-10 text-center text-muted-foreground space-y-2">
          <MessageSquare className="h-8 w-8 mx-auto text-link/30" />
          <p className="text-xs font-medium">Chưa có bình luận nào.</p>
          <p className="text-[11px] text-muted-foreground">
            Hãy là người đầu tiên chia sẻ cảm nghĩ về {chapterId ? 'chương này' : 'tác phẩm này'}!
          </p>
        </div>
      )}
    </div>
  )
}
