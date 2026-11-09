import React, { useState } from 'react'
import { Heart, Trash2, Edit3, MessageSquareQuote } from 'lucide-react'
import type { Review } from '@/types/review'
import { useAuthStore } from '@/features/auth/store/authStore'
import { Badge } from '@/components/ui/badge'

interface ReviewCardProps {
  review: Review
  onLike: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onEdit?: () => void
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

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  onLike,
  onDelete,
  onEdit,
}) => {
  const { user, isAuthenticated } = useAuthStore()
  const [isPending, setIsPending] = useState(false)

  const isOwner = Boolean(user?.id && user.id === review.userId?._id)
  const isMod = user?.role === 'moderator' || user?.role === 'admin'
  const canDelete = isOwner || isMod

  const handleLike = async () => {
    if (!isAuthenticated || review.isDeleted) return
    setIsPending(true)
    try {
      await onLike(review._id)
    } finally {
      setIsPending(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài cảm nhận này?')) return
    setIsPending(true)
    try {
      await onDelete(review._id)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs hover:shadow-card transition-all space-y-4">
      {/* Header: User & Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-secondary text-link flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden border border-border shadow-2xs">
            {review.userId?.avatarUrl ? (
              <img
                src={review.userId.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              (review.userId?.displayName || review.userId?.username || 'U')
                .charAt(0)
                .toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="break-words font-bold text-xs sm:text-sm text-foreground">
                {review.userId?.displayName || review.userId?.username}
              </h4>
              {['moderator', 'admin'].includes(review.userId?.role) && (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold">
                  BQT
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {formatRelativeTime(review.createdAt)}
            </span>
          </div>
        </div>

        {/* Quote Icon */}
        <MessageSquareQuote className="h-6 w-6 text-link/20 shrink-0" />
      </div>

      {/* Content */}
      <div className="break-words text-xs sm:text-sm leading-relaxed text-foreground/90 whitespace-pre-line font-serif pl-1">
        {review.content}
      </div>

      {/* Footer: Like & Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs">
        {/* Like helpful button */}
        <button
          type="button"
          onClick={handleLike}
          disabled={isPending || !isAuthenticated}
          aria-pressed={!!review.likedByMe}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
            review.likedByMe
              ? 'text-link font-bold bg-primary/10'
              : 'text-muted-foreground hover:text-link hover:bg-surface-raised'
          }`}
          title={isAuthenticated ? 'Cảm nhận hữu ích' : 'Đăng nhập để thích'}
        >
          <Heart
            className={`h-4 w-4 ${review.likedByMe ? 'fill-primary text-link' : ''}`}
          />
          <span>{review.likeCount > 0 ? `${review.likeCount} Hữu ích` : 'Hữu ích'}</span>
        </button>

        {/* Edit / Delete actions */}
        <div className="flex items-center gap-2">
          {isOwner && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-1 text-muted-foreground hover:text-link transition-colors cursor-pointer rounded"
              title="Chỉnh sửa bài cảm nhận"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer rounded"
              title="Xóa bài cảm nhận"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
