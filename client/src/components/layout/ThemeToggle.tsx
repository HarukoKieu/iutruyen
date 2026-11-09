import React from 'react'
import { Moon, Sun, BookOpen, Droplets } from 'lucide-react'
import { useTheme } from 'next-themes'

const THEMES = ['light', 'soft-blue', 'sepia', 'dark'] as const

const themeLabels: Record<(typeof THEMES)[number], string> = {
  light: 'Chế độ sáng (White & Sky Blue)',
  'soft-blue': 'Chế độ xanh dịu (Soft Blue)',
  sepia: 'Chế độ sepia (Warm Parchment)',
  dark: 'Chế độ tối (Midnight Navy)',
}

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const current = (theme ?? resolvedTheme ?? 'light') as (typeof THEMES)[number]

  const cycleTheme = () => {
    const index = THEMES.indexOf(current)
    const next = THEMES[(index + 1) % THEMES.length]
    setTheme(next)
  }

  if (!mounted) {
    return (
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground"
        aria-label="Chuyển giao diện"
      >
        <Sun className="h-4 w-4" />
      </button>
    )
  }

  const Icon =
    current === 'light'
      ? Sun
      : current === 'soft-blue'
      ? Droplets
      : current === 'sepia'
      ? BookOpen
      : Moon

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-link hover:bg-secondary transition-colors cursor-pointer"
      aria-label={themeLabels[current] ?? 'Chuyển giao diện'}
      title={themeLabels[current]}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

export default ThemeToggle
