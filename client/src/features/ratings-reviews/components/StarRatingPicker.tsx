import React, { useState } from 'react'
import { Star } from 'lucide-react'

interface StarRatingPickerProps {
  rating: number
  onChange?: (score: number) => void
  readOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const RATING_LABELS: Record<number, string> = {
  1: 'Dở tệ',
  2: 'Tạm được',
  3: 'Bình thường',
  4: 'Hay, đáng đọc',
  5: 'Tuyệt tác siêu phẩm',
}

export const StarRatingPicker: React.FC<StarRatingPickerProps> = ({
  rating,
  onChange,
  readOnly = false,
  size = 'md',
}) => {
  const [hoverScore, setHoverScore] = useState<number | null>(null)

  const activeScore = hoverScore ?? rating

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div role="group" aria-label={readOnly ? `Đánh giá: ${rating} trên 5 sao` : 'Chọn điểm đánh giá'} className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeScore
          return (
            <button
              key={star}
              type="button"
              disabled={readOnly}
              aria-label={`${star} sao: ${RATING_LABELS[star]}`}
              aria-pressed={rating === star}
              onClick={() => onChange?.(star)}
              onMouseEnter={() => !readOnly && setHoverScore(star)}
              onMouseLeave={() => !readOnly && setHoverScore(null)}
              onFocus={() => !readOnly && setHoverScore(star)}
              onBlur={() => setHoverScore(null)}
              className={`flex min-h-8 min-w-8 items-center justify-center rounded-md transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                readOnly
                  ? 'cursor-default'
                  : 'cursor-pointer hover:scale-115 active:scale-95'
              }`}
              title={RATING_LABELS[star]}
            >
              <Star
                className={`${sizeClasses[size]} transition-colors ${
                  isFilled
                    ? 'fill-warning text-warning drop-shadow-xs'
                    : 'text-border hover:text-warning/70'
                }`}
              />
            </button>
          )
        })}
      </div>

      {!readOnly && (
        <span className="text-[11px] font-semibold text-link transition-all">
          {activeScore > 0 ? `${activeScore}★ - ${RATING_LABELS[activeScore]}` : 'Chọn số sao đánh giá'}
        </span>
      )}
    </div>
  )
}
