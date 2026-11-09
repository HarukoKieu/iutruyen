import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReadingProgress } from './useReadingProgress'

describe('reader progress restoration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16))
    vi.stubGlobal('cancelAnimationFrame', clearTimeout)
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
  it('restores same chapter before enabling history writes and resets another chapter', () => {
    localStorage.setItem('novel_last_read', JSON.stringify({ chapterId: 'one', scrollPositionPercent: 65 }))
    const { result, rerender } = renderHook(({ id }) => useReadingProgress(id, true), { initialProps: { id: 'one' } })
    expect(result.current.progressReady).toBe(false)
    act(() => vi.advanceTimersByTime(16))
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 650, behavior: 'instant' })
    expect(result.current).toEqual({ progressReady: true, readingProgress: 65 })
    rerender({ id: 'two' })
    expect(result.current.progressReady).toBe(false)
    act(() => vi.advanceTimersByTime(16))
    expect(result.current).toEqual({ progressReady: true, readingProgress: 0 })
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
  })
  it('waits for the mature-content gate and cancels restoration on unmount', () => {
    const { result, rerender, unmount } = renderHook(({ enabled }) => useReadingProgress('one', enabled), { initialProps: { enabled: false } })
    act(() => vi.advanceTimersByTime(100))
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(result.current.progressReady).toBe(false)
    rerender({ enabled: true })
    unmount()
    act(() => vi.advanceTimersByTime(100))
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
