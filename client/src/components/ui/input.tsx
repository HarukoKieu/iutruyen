import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, id, 'aria-describedby': describedBy, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`
    return (
      <div className="w-full">
        <input
          type={type}
          id={inputId}
          className={cn(
            'flex h-11 w-full min-w-0 rounded-full border border-border bg-surface-elevated px-5 py-2 text-base sm:text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          ref={ref}
          {...props}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={[describedBy, error ? errorId : null].filter(Boolean).join(' ') || undefined}
        />
        {error ? <p id={errorId} role="alert" className="mt-1.5 px-3 text-sm text-destructive">{error}</p> : null}
      </div>
    )
  }
)
Input.displayName = 'Input'
