import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'link'
    | 'destructive'
    | 'sky'
    | 'gold'
    | 'accent'
    | 'crimson'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm'
  isLoading?: boolean
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', isLoading, asChild = false, children, disabled, ...props }, ref) => {
    const variantClasses: Record<string, string> = {
      default:
        'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:shadow-md transition-all active:scale-[0.98]',
      primary:
        'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:shadow-md transition-all active:scale-[0.98]',
      sky:
        'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:shadow-md transition-all active:scale-[0.98]',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium shadow-xs hover:shadow-sm transition-all active:scale-[0.98]',
      outline:
        'border border-border bg-card text-foreground hover:bg-surface-raised hover:border-primary/40 transition-all active:scale-[0.98]',
      ghost:
        'text-foreground hover:bg-surface-raised hover:text-link transition-all',
      link:
        'text-link underline-offset-4 hover:underline p-0 h-auto font-normal',
      destructive:
        'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm transition-all active:scale-[0.98]',
      gold:
        'bg-primary text-primary-foreground font-bold hover:bg-primary-hover shadow-sm hover:shadow-md transition-all active:scale-[0.98]',
      accent:
        'bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm hover:shadow-md transition-all active:scale-[0.98]',
      crimson:
        'bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm hover:shadow-md transition-all active:scale-[0.98]',
    }

    const sizeClasses: Record<string, string> = {
      default: 'h-10 px-5 py-2 text-sm',
      sm: 'h-8 px-3 text-xs',
      lg: 'h-12 px-7 text-base font-semibold',
      icon: 'h-10 w-10 p-0',
      'icon-sm': 'h-8 w-8 p-0',
    }

    const baseClassName = cn(
      'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
      variantClasses[variant] || variantClasses.default,
      sizeClasses[size] || sizeClasses.default,
      className
    )

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        className: cn(baseClassName, (children.props as any)?.className),
        ...props,
      })
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={baseClassName}
        {...props}
      >
        {isLoading ? (
          <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
