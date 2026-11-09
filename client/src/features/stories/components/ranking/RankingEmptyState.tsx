import React from 'react'
import { Trophy, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RankingEmptyStateProps {
  selectedGenre?: string
  genreName?: string
  onResetGenre: () => void
}

export const RankingEmptyState: React.FC<RankingEmptyStateProps> = ({
  selectedGenre,
  genreName,
  onResetGenre,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-3xl border border-dashed border-border bg-card/60 shadow-xs"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised border border-border text-muted-foreground mb-4">
        <Trophy className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
      </div>
      <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground">
        {selectedGenre
          ? `Chưa có truyện xếp hạng cho thể loại "${genreName || selectedGenre}"`
          : 'Chưa có dữ liệu bảng xếp hạng'}
      </h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
        {selectedGenre
          ? 'Không tìm thấy tác phẩm nào đạt tiêu chí xếp hạng trong thể loại này. Hãy khám phá tất cả các thể loại khác!'
          : 'Hệ thống đang tổng hợp dữ liệu xếp hạng mới nhất. Vui lòng quay lại sau ít phút.'}
      </p>

      {selectedGenre && (
        <Button
          type="button"
          onClick={onResetGenre}
          className="mt-5 inline-flex items-center gap-2 rounded-xl"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Xem tất cả thể loại</span>
        </Button>
      )}
    </div>
  )
}
