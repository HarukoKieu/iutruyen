import React, { useState } from 'react'
import { BookOpen } from 'lucide-react'

interface RankingCoverProps {
  coverUrl?: string | null
  title: string
  className?: string
  priority?: boolean
}

export const RankingCover: React.FC<RankingCoverProps> = ({
  coverUrl,
  title,
  className = '',
  priority = false,
}) => {
  const [hasError, setHasError] = useState(false)

  const showFallback = !coverUrl || hasError

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-surface-raised border border-border/80 flex items-center justify-center shrink-0 ${className}`}
    >
      {showFallback ? (
        <div
          className="flex h-full w-full flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-surface-raised to-muted text-muted-foreground select-none"
          aria-hidden="true"
        >
          <BookOpen className="h-7 w-7 sm:h-9 sm:w-9 opacity-40 text-primary" />
        </div>
      ) : (
        <img
          src={coverUrl}
          alt={`Bìa truyện ${title}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setHasError(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )}
    </div>
  )
}
