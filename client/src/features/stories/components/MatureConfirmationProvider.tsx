import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { browserSessionStorage } from '@/lib/browserStorage'
import { MatureConfirmationContext } from '../hooks/useMatureConfirmation'

interface MatureConfirmationProviderProps {
  children: ReactNode
}

/** Each app/SSR request owns its consent state; never read storage during server render. */
export default function MatureConfirmationProvider({ children }: MatureConfirmationProviderProps) {
  const [confirmedStoryIds, setConfirmedStoryIds] = useState<ReadonlySet<string>>(() => new Set())
  const rememberStory = useCallback((storyId: string) => {
    if (!storyId) return
    setConfirmedStoryIds(previous => previous.has(storyId) ? previous : new Set([...previous, storyId]))
  }, [])
  const confirmStory = useCallback((storyId: string) => {
    if (!storyId) return
    rememberStory(storyId)
    browserSessionStorage.setItem(`mature_confirmed_${storyId}`, '1')
  }, [rememberStory])
  const restoreStory = useCallback((storyId: string) => {
    if (browserSessionStorage.getItem(`mature_confirmed_${storyId}`) === '1') rememberStory(storyId)
  }, [rememberStory])
  const value = useMemo(() => ({ confirmedStoryIds, confirmStory, restoreStory }), [confirmedStoryIds, confirmStory, restoreStory])
  return <MatureConfirmationContext.Provider value={value}>{children}</MatureConfirmationContext.Provider>
}
