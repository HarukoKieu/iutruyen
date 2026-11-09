import React from 'react'
import { Star } from 'lucide-react'
import { CommentList } from '@/features/comments/components/CommentList'
import { StarRatingPicker } from '@/features/ratings-reviews/components/StarRatingPicker'
import { ReviewSection } from '@/features/ratings-reviews/components/ReviewSection'
import {
  useMyRating,
  useRatingMutation,
} from '@/features/ratings-reviews/hooks/useRatingsReviews'
import { useAuthStore } from '@/features/auth/store/authStore'

interface StoryDiscussionSectionProps {
  storyId: string
  storyTitle?: string
  storyAuthorId?: string
  ratingAverage: number
  ratingCount: number
}

export const StoryDiscussionSection: React.FC<StoryDiscussionSectionProps> = ({
  storyId,
  storyTitle = '',
  storyAuthorId,
  ratingAverage,
  ratingCount,
}) => {
  const { isAuthenticated } = useAuthStore()

  // Ratings
  const { data: myRatingData } = useMyRating(storyId, isAuthenticated)
  const { mutate: submitRating } = useRatingMutation(storyId)

  const userRatingScore = myRatingData?.score ?? 0

  const handleRatingChange = (score: number) => {
    if (!isAuthenticated) {
      alert('Vui lòng đăng nhập để đánh giá sao cho truyện.')
      return
    }
    submitRating(score)
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-card space-y-6">
      {/* ── TOP SECTION: OVERALL RATING & USER STAR PICKER ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-raised/50 p-4 sm:p-5 rounded-2xl border border-border/50">
        {/* Overall Rating Stats */}
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="flex h-12 w-12 rounded-2xl bg-amber-400/10 text-amber-500 items-center justify-center shrink-0 border border-amber-400/20 shadow-2xs">
            <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
                {ratingAverage > 0 ? ratingAverage.toFixed(1) : '5.0'}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">/ 5★</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {ratingCount || 0} lượt bạn đọc đánh giá
            </p>
          </div>
        </div>

        {/* User Interactive Rating Picker */}
        <div className="flex flex-col items-center sm:items-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60 w-full sm:w-auto">
          <span className="text-xs font-bold text-foreground">
            {userRatingScore > 0 ? 'Đánh giá của bạn:' : 'Chấm điểm tác phẩm:'}
          </span>
          <StarRatingPicker
            rating={userRatingScore}
            onChange={handleRatingChange}
            size="md"
          />
        </div>
      </div>

      <ReviewSection storyId={storyId} storyTitle={storyTitle} />

      {/* ── COMMENTS SECTION WITH REPLIES (MAX 1-LEVEL REPLIES) ── */}
      <CommentList
        storyId={storyId}
        storyAuthorId={storyAuthorId}
      />
    </div>
  )
}
