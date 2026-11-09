import { useEffect, useState } from 'react'

/** Restore only this chapter before allowing any history writes. */
export function useReadingProgress(chapterId: string, enabled: boolean) {
  const [state, setState] = useState({ chapterId: '', percent: 0 })
  useEffect(() => {
    if (!chapterId || !enabled) {
      setState({ chapterId: '', percent: 0 })
      return
    }
    let percent = 0
    try {
      const saved = JSON.parse(localStorage.getItem('novel_last_read') || 'null')
      if (saved?.chapterId === chapterId && typeof saved.scrollPositionPercent === 'number' && Number.isFinite(saved.scrollPositionPercent)) {
        percent = Math.max(0, Math.min(100, saved.scrollPositionPercent))
      }
    } catch { /* Storage availability never blocks reading. */ }
    const frame = requestAnimationFrame(() => {
      const height = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      window.scrollTo({ top: height * percent / 100, behavior: 'instant' })
      setState({ chapterId, percent })
    })
    return () => cancelAnimationFrame(frame)
  }, [chapterId, enabled])

  const ready = enabled && state.chapterId === chapterId
  useEffect(() => {
    if (!ready) return
    const onScroll = () => {
      const root = document.documentElement
      const height = root.scrollHeight - (root.clientHeight || window.innerHeight)
      const percent = height > 0 ? Math.max(0, Math.min(100, Math.round((window.scrollY / height) * 100))) : 0
      setState({ chapterId, percent })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [chapterId, ready])
  return { readingProgress: ready ? state.percent : 0, progressReady: ready }
}
