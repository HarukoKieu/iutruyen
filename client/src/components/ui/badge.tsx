import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'success'
    | 'warning'
    | 'destructive'
    | 'muted'
    | 'subtle'
    | 'gold'
    | 'crimson'
    | 'sky'
}

const badgeVariantClasses: Record<string, string> = {
  default: 'bg-primary text-primary-foreground font-semibold shadow-xs',
  sky: 'bg-secondary text-foreground font-medium border border-border',
  secondary: 'bg-secondary text-foreground font-medium border border-border-subtle',
  outline: 'border border-border text-foreground bg-card',
  success: 'bg-success/15 text-success border border-success/30 font-medium',
  warning: 'bg-warning/15 text-warning border border-warning/30 font-medium',
  destructive: 'bg-destructive/15 text-destructive border border-destructive/30 font-medium',
  muted: 'bg-surface-raised text-muted-foreground border border-border-subtle',
  subtle: 'bg-surface-raised text-muted-foreground',
  gold: 'bg-primary/15 text-link border border-primary/30 font-medium',
  crimson: 'bg-destructive/15 text-destructive border border-destructive/30 font-medium',
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors select-none',
          badgeVariantClasses[variant] || badgeVariantClasses.default,
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = 'Badge'
