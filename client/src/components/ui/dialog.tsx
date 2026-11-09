import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleId: string
  descriptionId: string
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  onOpenChange: () => {},
  titleId: '',
  descriptionId: '',
})

export const Dialog: React.FC<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}> = ({ open = false, onOpenChange, children }) => {
  const id = React.useId()
  return (
    <DialogContext.Provider value={{ open, onOpenChange: onOpenChange || (() => {}), titleId: `${id}-title`, descriptionId: `${id}-description` }}>
      {children}
    </DialogContext.Provider>
  )
}

export const DialogTrigger: React.FC<{
  asChild?: boolean
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>
}> = ({ children }) => {
  const { onOpenChange } = React.useContext(DialogContext)
  return React.cloneElement(children, {
    onClick: event => {
      children.props.onClick?.(event)
      if (!event.defaultPrevented) onOpenChange(true)
    },
  })
}

export const DialogContent: React.FC<{
  className?: string
  children: React.ReactNode
}> = ({ className, children }) => {
  const { open, onOpenChange, titleId, descriptionId } = React.useContext(DialogContext)
  const containerRef = React.useRef<HTMLDivElement>(null)
  useModalAccessibility({ open, onClose: () => onOpenChange(false), containerRef })

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        data-modal-backdrop=""
        aria-hidden="true"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          'relative z-50 w-full min-w-0 max-w-lg rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xl break-words',
          'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4',
          'max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain',
          className
        )}
      >
        <button
          type="button"
          aria-label="Đóng hộp thoại"
          onClick={() => onOpenChange(false)}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  )
}

export const DialogHeader: React.FC<{
  className?: string
  children: React.ReactNode
}> = ({ className, children }) => (
  <div className={cn('mb-4 space-y-1.5', className)}>{children}</div>
)

export const DialogTitle: React.FC<{
  className?: string
  children: React.ReactNode
}> = ({ className, children }) => {
  const { titleId } = React.useContext(DialogContext)
  return <h2 id={titleId} className={cn('pr-9 text-lg font-semibold leading-snug tracking-tight', className)}>
    {children}
  </h2>
}

export const DialogDescription: React.FC<{
  className?: string
  children: React.ReactNode
}> = ({ className, children }) => {
  const { descriptionId } = React.useContext(DialogContext)
  return <p id={descriptionId} className={cn('text-sm text-muted-foreground', className)}>{children}</p>
}

export const DialogFooter: React.FC<{
  className?: string
  children: React.ReactNode
}> = ({ className, children }) => (
  <div className={cn('mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3', className)}>{children}</div>
)
