import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, error, id, disabled, 'aria-describedby': describedBy, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`

    return (
      <div className="w-full">
        <div className="relative flex items-center">
          <input
            type={showPassword ? 'text' : 'password'}
            id={inputId}
            disabled={disabled}
            className={cn(
              'flex h-11 w-full min-w-0 rounded-full border border-border bg-surface-elevated pl-5 pr-14 py-2 text-base sm:text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive focus-visible:ring-destructive',
              className
            )}
            ref={ref}
            {...props}
            aria-invalid={error ? true : props['aria-invalid']}
            aria-describedby={[describedBy, error ? errorId : null].filter(Boolean).join(' ') || undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={disabled}
            className="absolute right-1 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={showPassword}
            aria-controls={inputId}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error ? <p id={errorId} role="alert" className="mt-1.5 px-3 text-sm text-destructive">{error}</p> : null}
      </div>
    )
  }
)
PasswordInput.displayName = 'PasswordInput'
