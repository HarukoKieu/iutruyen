import React from 'react'
import { Flame, Heart, Star, BookOpen } from 'lucide-react'
import type { Story } from '@/types/story'
import type { RankingMetric } from '@/types/ranking'

export const formatMetricNumber = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num?.toLocaleString('vi-VN') || '0'
}

export interface MetricDisplayData {
  icon: React.ReactNode
  value: string
  label: string
  rawNumeric: number
}

export const getStoryMetricDisplay = (
  story: Story,
  metric: RankingMetric
): MetricDisplayData => {
  switch (metric) {
    case 'follows':
      return {
        icon: <Heart className="h-4 w-4 text-rose-500 fill-rose-500" aria-hidden="true" />,
        value: formatMetricNumber(story.followCount || 0),
        label: 'lượt theo dõi',
        rawNumeric: story.followCount || 0,
      }
    case 'rating':
      return {
        icon: <Star className="h-4 w-4 text-amber-500 fill-amber-500" aria-hidden="true" />,
        value: story.ratingAverage ? story.ratingAverage.toFixed(1) : '5.0',
        label: story.ratingCount ? `(${story.ratingCount} đánh giá)` : '(Chưa có đánh giá)',
        rawNumeric: story.ratingAverage || 0,
      }
    case 'chapters':
      return {
        icon: <BookOpen className="h-4 w-4 text-emerald-500" aria-hidden="true" />,
        value: (story.chapterCount || 0).toLocaleString('vi-VN'),
        label: 'chương',
        rawNumeric: story.chapterCount || 0,
      }
    case 'views':
    default:
      return {
        icon: <Flame className="h-4 w-4 text-amber-500 fill-amber-500" aria-hidden="true" />,
        value: formatMetricNumber(story.viewCount || 0),
        label: 'lượt đọc',
        rawNumeric: story.viewCount || 0,
      }
  }
}
