import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'
import { Button } from './button'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'

interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'warning'
  onConfirm: () => void
  isLoading?: boolean
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  variant = 'destructive',
  onConfirm,
  isLoading,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()
  useModalAccessibility({ open, onClose: () => { if (!isLoading) onOpenChange(false) }, containerRef, initialFocusRef: cancelRef })

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        data-modal-backdrop=""
        aria-hidden="true"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { if (!isLoading) onOpenChange(false) }}
      />
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        aria-busy={isLoading || undefined}
        className={cn(
          'relative z-50 w-full min-w-0 max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xl break-words',
          'animate-in fade-in-0 zoom-in-95'
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              variant === 'destructive'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-warning/10 text-warning'
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-2">
            <h2 id={`${id}-title`} className="text-lg font-semibold">{title}</h2>
            <p id={`${id}-description`} className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="rounded-full"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-full"
          >
            {isLoading ? 'Đang xử lý...' : confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
