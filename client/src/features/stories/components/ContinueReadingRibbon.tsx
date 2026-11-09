import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReadingHistoryItem {
  storyId: string
  storySlug: string
  storyTitle: string
  coverUrl?: string
  chapterId: string
  chapterNumber: number
  chapterTitle: string
  totalChapters?: number
  progressPercent?: number
  lastReadAt: string
}

export const ContinueReadingRibbon: React.FC = () => {
  const [lastRead, setLastRead] = useState<ReadingHistoryItem | null>(null)

  useEffect(() => {
    try {
      // Check localStorage for reading history
      const raw = localStorage.getItem('novel_last_read')
      if (raw) {
        const parsed = JSON.parse(raw)
        setLastRead(parsed)
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  if (!lastRead) return null

  const progress = lastRead.progressPercent || Math.min(Math.round(((lastRead.chapterNumber || 1) / (lastRead.totalChapters || 100)) * 100), 100)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-secondary via-card to-card p-4 sm:p-5 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Story Info */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <BookOpen className="h-5 w-5 fill-white/20" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-link">
                Đang đọc dở
              </span>
              <span className="text-xs text-muted-foreground">• Tiến độ: {progress}%</span>
            </div>
            <h4 className="font-serif text-sm sm:text-base font-bold text-foreground truncate">
              {lastRead.storyTitle}
            </h4>
            <p className="text-xs text-muted-foreground truncate">
              Chương {lastRead.chapterNumber}: {lastRead.chapterTitle}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button asChild variant="default" size="sm" className="rounded-full">
            <Link to={`/stories/${lastRead.storySlug}`}>
              <Play className="h-3.5 w-3.5 fill-white" />
              Đọc Tiếp
            </Link>
          </Button>
        </div>
      </div>

      {/* Mini Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-raised">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export default ContinueReadingRibbon
