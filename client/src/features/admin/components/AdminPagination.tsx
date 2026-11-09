import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AdminPagination({
  hasPrevious,
  hasMore,
  pending,
  onPrevious,
  onNext,
}: {
  hasPrevious: boolean
  hasMore: boolean
  pending: boolean
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <nav
      aria-label="Phân trang"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border"
    >
      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
        {pending ? (
          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Đang tải dữ liệu trang…
          </span>
        ) : (
          <span>Điều hướng danh sách theo cursor phân trang</span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrevious || pending}
          onClick={onPrevious}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Trang trước</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore || pending}
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all"
        >
          <span>Trang sau</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  )
}

