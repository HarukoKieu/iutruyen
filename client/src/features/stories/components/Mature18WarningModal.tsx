import React from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'

interface Mature18WarningModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const Mature18WarningModal: React.FC<Mature18WarningModalProps> = ({
  open,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  useModalAccessibility({ open, onClose: onCancel, containerRef: dialogRef })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div data-modal-backdrop aria-hidden="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-50 mx-4 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-destructive/30 bg-card p-5 sm:p-8 shadow-2xl animate-in fade-in-0 zoom-in-95">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <ShieldAlert className="h-8 w-8 text-red-500" />
          </div>

          <h2 id={titleId} className="text-xl font-bold text-foreground">Cảnh báo nội dung 18+</h2>

          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-left">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Truyện này chứa nội dung dành cho người lớn (18+). Bạn phải xác nhận rằng bạn đủ 18 tuổi để tiếp tục đọc.
            </p>
          </div>

          <div className="mt-6 flex w-full flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={onCancel}
            >
              Quay lại
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-full"
              onClick={onConfirm}
            >
              Tôi đủ 18 tuổi
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Mature18WarningModal
