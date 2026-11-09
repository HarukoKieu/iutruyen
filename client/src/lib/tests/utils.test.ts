import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    expect(cn('btn', 'btn-primary')).toBe('btn btn-primary')
  })

  it('should handle conditionals and omit falsy values', () => {
    const isPrimary = true
    const isHidden = false
    expect(cn('base-class', isPrimary && 'text-primary', isHidden && 'hidden')).toBe(
      'base-class text-primary'
    )
  })

  it('should merge tailwind conflicts correctly using twMerge', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
})
