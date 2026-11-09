import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'flex h-11 w-full appearance-none rounded-full border border-border bg-surface-elevated px-5 pr-10 py-2 text-sm text-foreground ring-offset-background',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors cursor-pointer',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    )
  }
)
Select.displayName = 'Select'
