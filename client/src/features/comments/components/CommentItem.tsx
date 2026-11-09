import React, { useState } from 'react'
import {
  Heart,
  Trash2,
  Lock,
  Unlock,
  Edit3,
  Check,
  X,
  Reply,
  Send,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
} from 'lucide-react'
import type { Comment } from '@/types/comment'
import { useAuthStore } from '@/features/auth/store/authStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useReplies } from '../hooks/useComments'

interface CommentItemProps {
  comment: Comment
  storyAuthorId?: string
  onLike: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (id: string, newContent: string) => Promise<void>
  onToggleLock: (id: string) => Promise<void>
  onReply?: (parentId: string, content: string) => Promise<void>
  isReply?: boolean
}

const formatRelativeTime = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ngày trước`
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  storyAuthorId,
  onLike,
  onDelete,
  onUpdate,
  onToggleLock,
  onReply,
  isReply = false,
}) => {
  const { user, isAuthenticated } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [isActionPending, setIsActionPending] = useState(false)

  // Reply form state
  const [isReplying, setIsReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isSendingReply, setIsSendingReply] = useState(false)

  // Show all replies state
  const [showAllReplies, setShowAllReplies] = useState(false)
  const {
    data: allRepliesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useReplies(comment._id, showAllReplies)

  // Permissions
  const isOwner = user?.id === comment.userId?._id
  const isStoryAuthor = storyAuthorId && user?.id === storyAuthorId
  const isMod = user?.role === 'moderator' || user?.role === 'admin'
  const canDelete = isOwner || isStoryAuthor || isMod
  const canLock = isStoryAuthor || isMod
  const canEdit = isOwner && !comment.isDeleted && !comment.isLocked
  const isAuthorOfStory = storyAuthorId && comment.userId?._id === storyAuthorId

  // Replies data: if expanded, use paginated replies; otherwise use initial previewReplies (up to 2)
  const expandedReplies = allRepliesData?.pages.flatMap((p) => p.items) ?? []
  const previewReplies = comment.previewReplies || []
  const displayedReplies = showAllReplies ? expandedReplies : previewReplies
  const totalReplies = comment.replyCount || previewReplies.length

  const handleLike = async () => {
    if (!isAuthenticated || comment.isDeleted) return
    setIsActionPending(true)
    try {
      await onLike(comment._id)
    } finally {
      setIsActionPending(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return
    setIsActionPending(true)
    try {
      await onDelete(comment._id)
    } finally {
      setIsActionPending(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === comment.content) {
      setIsEditing(false)
      return
    }
    setIsActionPending(true)
    try {
      await onUpdate(comment._id, editContent.trim())
      setIsEditing(false)
    } finally {
      setIsActionPending(false)
    }
  }

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !onReply) return
    setIsSendingReply(true)
    try {
      await onReply(comment._id, replyText.trim())
      setReplyText('')
      setIsReplying(false)
      // Expand replies to view the new reply
      setShowAllReplies(true)
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Không thể gửi phản hồi.')
    } finally {
      setIsSendingReply(false)
    }
  }

  return (
    <div className={`space-y-2.5 ${isReply ? 'ml-6 sm:ml-9' : ''}`}>
      {/* ── MAIN COMMENT CARD ── */}
      <div
        className={`group relative rounded-2xl border p-3.5 sm:p-4 transition-all ${
          isReply
            ? 'border-border/40 bg-surface-raised/40 hover:bg-surface-raised/70'
            : comment.isLocked
              ? 'border-amber-200/80 bg-amber-50/20 dark:bg-amber-950/10'
              : 'border-border/60 bg-card hover:border-border hover:shadow-2xs'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* User Avatar */}
          <div
            className={`rounded-full bg-secondary text-link flex items-center justify-center font-bold shrink-0 overflow-hidden border border-border shadow-2xs ${
              isReply ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs'
            }`}
          >
            {comment.userId?.avatarUrl ? (
              <img
                src={comment.userId.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              (comment.userId?.displayName || comment.userId?.username || 'U')
                .charAt(0)
                .toUpperCase()
            )}
          </div>

          {/* Comment Body */}
          <div className="flex-1 min-w-0">
            {/* Header Row: Name, Badges, Time */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
              <div className="min-w-0 flex flex-wrap items-center gap-1.5 break-words">
                <span className="font-semibold text-xs text-foreground">
                  {comment.userId?.displayName || comment.userId?.username || 'Bạn đọc'}
                </span>

                {/* Reply To Mention tag */}
                {comment.replyToUserId && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground font-medium">
                    <CornerDownRight className="h-3 w-3 text-link/60" />
                    <span className="text-link font-semibold">
                      @{comment.replyToUserId.displayName || comment.replyToUserId.username}
                    </span>
                  </span>
                )}

                {/* Author badge */}
                {isAuthorOfStory && (
                  <Badge
                    variant="default"
                    className="text-[10px] px-1.5 py-0 font-bold bg-primary text-primary-foreground"
                  >
                    Tác Giả
                  </Badge>
                )}

                {/* Mod/Admin badge */}
                {['moderator', 'admin'].includes(comment.userId?.role) && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 font-semibold"
                  >
                    BQT
                  </Badge>
                )}

                {comment.isLocked && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    <Lock className="h-3 w-3" /> Đã khoá
                  </span>
                )}
              </div>

              <span className="text-[11px] text-muted-foreground">
                {formatRelativeTime(comment.createdAt)}
              </span>
            </div>

            {/* Comment Content */}
            {isEditing ? (
              <div className="mt-2 space-y-2">
                <textarea
                  aria-label="Chỉnh sửa nội dung bình luận"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  maxLength={1000}
                  rows={2}
                  className="w-full rounded-xl border border-primary/40 bg-surface-raised p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isActionPending}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-2xs hover:bg-primary-hover transition-colors"
                  >
                    <Check className="h-3 w-3" /> Lưu
                  </button>
                  <button
                    onClick={() => {
                      setEditContent(comment.content)
                      setIsEditing(false)
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <X className="h-3 w-3" /> Hủy
                  </button>
                </div>
              </div>
            ) : (
              <p
                className={`text-xs leading-relaxed break-words ${
                  comment.isDeleted
                    ? 'italic text-muted-foreground'
                    : 'text-foreground/90'
                }`}
              >
                {comment.content}
              </p>
            )}

            {/* Action Row: Like + Reply + Edit/Delete/Lock actions */}
            {!comment.isDeleted && (
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-1 border-t border-border/30 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Like Button */}
                  <button
                    type="button"
                    onClick={handleLike}
                    disabled={isActionPending || !isAuthenticated}
                    aria-pressed={!!comment.likedByMe}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                      comment.likedByMe
                        ? 'text-link font-bold bg-primary/10'
                        : 'text-muted-foreground hover:text-link hover:bg-surface-raised'
                    }`}
                    title={isAuthenticated ? 'Thích bình luận' : 'Đăng nhập để thích'}
                  >
                    <Heart
                      className={`h-3.5 w-3.5 ${
                        comment.likedByMe ? 'fill-primary text-link' : ''
                      }`}
                    />
                    <span>{comment.likeCount > 0 ? comment.likeCount : 'Thích'}</span>
                  </button>

                  {/* Reply Button — always visible, login prompt when not authenticated */}
                  {onReply && !comment.isLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAuthenticated) {
                          alert('Vui lòng đăng nhập để trả lời bình luận.')
                          return
                        }
                        setIsReplying(!isReplying)
                      }}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-link transition-colors cursor-pointer"
                    >
                      <Reply className="h-3.5 w-3.5" />
                      <span>{isReplying ? 'Hủy' : 'Trả lời'}</span>
                    </button>
                  )}
                </div>

                {/* Actions: Edit / Lock / Delete */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  {canEdit && !isEditing && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="p-1 text-muted-foreground hover:text-link transition-colors cursor-pointer rounded"
                      title="Chỉnh sửa bình luận"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {canLock && !isReply && (
                    <button
                      type="button"
                      onClick={() => onToggleLock(comment._id)}
                      disabled={isActionPending}
                      className="p-1 text-muted-foreground hover:text-amber-600 transition-colors cursor-pointer rounded"
                      title={comment.isLocked ? 'Mở khoá bình luận' : 'Khoá bình luận'}
                    >
                      {comment.isLocked ? (
                        <Unlock className="h-3.5 w-3.5" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isActionPending}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer rounded"
                      title="Xóa bình luận"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── INLINE REPLY INPUT FORM ── */}
      {isReplying && onReply && (
        <form
          onSubmit={handleSubmitReply}
          className="ml-6 sm:ml-9 flex items-center gap-2 rounded-2xl border border-primary/40 bg-card p-2 shadow-2xs animate-in fade-in duration-150"
        >
          <input
            type="text"
            aria-label="Nội dung trả lời bình luận"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Trả lời @${comment.userId?.displayName || comment.userId?.username}...`}
            maxLength={1000}
            autoFocus
            className="min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!replyText.trim() || isSendingReply}
            isLoading={isSendingReply}
            className="rounded-full h-7 px-3 text-xs font-bold shrink-0"
          >
            <Send className="h-3 w-3 mr-1" />
            Gửi
          </Button>
          <button
            type="button"
            aria-label="Hủy trả lời bình luận"
            onClick={() => {
              setIsReplying(false)
              setReplyText('')
            }}
            className="p-1 text-muted-foreground hover:text-foreground text-xs"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      )}

      {/* ── FLAT 1-LEVEL REPLIES LIST ── */}
      {!isReply && displayedReplies.length > 0 && (
        <div className="space-y-2 pt-1">
          {displayedReplies.map((replyItem) => (
            <CommentItem
              key={replyItem._id}
              comment={replyItem}
              storyAuthorId={storyAuthorId}
              onLike={onLike}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onToggleLock={onToggleLock}
              onReply={onReply}
              isReply={true}
            />
          ))}
        </div>
      )}

      {/* ── "XEM THÊM PHẢN HỒI" / "ẨN PHẢN HỒI" BUTTONS ── */}
      {!isReply && totalReplies > 2 && (
        <div className="ml-6 sm:ml-9 pt-0.5">
          {!showAllReplies ? (
            <button
              type="button"
              onClick={() => setShowAllReplies(true)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-link hover:underline cursor-pointer"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Xem thêm {totalReplies - previewReplies.length} phản hồi khác</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {hasNextPage && (
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-link hover:underline cursor-pointer"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>{isFetchingNextPage ? 'Đang tải...' : 'Tải thêm phản hồi'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAllReplies(false)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Ẩn bớt phản hồi</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
