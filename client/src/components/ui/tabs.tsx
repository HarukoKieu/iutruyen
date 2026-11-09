import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  id: string
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export const Tabs: React.FC<TabsProps> = ({
  value: controlledValue,
  defaultValue,
  onValueChange,
  children,
  className,
  ...props
}) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || '')
  const id = React.useId()
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : uncontrolledValue

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue)
      }
      onValueChange?.(newValue)
    },
    [isControlled, onValueChange]
  )

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange, id }}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        'inline-flex min-h-11 max-w-full flex-wrap items-center justify-center rounded-2xl bg-surface-raised p-1 text-muted-foreground',
        className
      )}
      {...props}
    />
  )
)
TabsList.displayName = 'TabsList'

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, onClick, onKeyDown, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    if (!context) throw new Error('TabsTrigger must be used within Tabs')

    const isSelected = context.value === value

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${context.id}-tab-${encodeURIComponent(value)}`}
        aria-selected={isSelected}
        aria-controls={`${context.id}-panel-${encodeURIComponent(value)}`}
        tabIndex={isSelected ? 0 : -1}
        className={cn(
          'inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          isSelected
            ? 'bg-card text-foreground shadow-[var(--shadow-sm)] font-semibold'
            : 'hover:bg-surface-hover hover:text-foreground',
          className
        )}
        onClick={event => { onClick?.(event); if (!event.defaultPrevented) context.onValueChange(value) }}
        onKeyDown={event => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return
          const list = event.currentTarget.closest('[role="tablist"]')
          const tabs = Array.from(list?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [])
          const index = tabs.indexOf(event.currentTarget)
          const vertical = list?.getAttribute('aria-orientation') === 'vertical'
          let next: number | undefined
          if (event.key === (vertical ? 'ArrowDown' : 'ArrowRight')) next = (index + 1) % tabs.length
          if (event.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) next = (index - 1 + tabs.length) % tabs.length
          if (event.key === 'Home') next = 0
          if (event.key === 'End') next = tabs.length - 1
          if (next !== undefined && tabs[next]) { event.preventDefault(); tabs[next].focus(); tabs[next].click() }
        }}
        {...props}
      >
        {children}
      </button>
    )
  }
)
TabsTrigger.displayName = 'TabsTrigger'

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    if (!context) throw new Error('TabsContent must be used within Tabs')

    if (context.value !== value) return null

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${context.id}-panel-${encodeURIComponent(value)}`}
        aria-labelledby={`${context.id}-tab-${encodeURIComponent(value)}`}
        tabIndex={0}
        className={cn(
          'mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TabsContent.displayName = 'TabsContent'
