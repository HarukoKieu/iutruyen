import { createContext, useContext, useEffect } from 'react'

interface MatureConfirmationState {
  confirmedStoryIds: ReadonlySet<string>
  confirmStory: (storyId: string) => void
  restoreStory: (storyId: string) => void
}

export const MatureConfirmationContext = createContext<MatureConfirmationState | null>(null)

/** Share consent by story ID; restore optional session state only after hydration. */
export function useMatureConfirmation(storyId: string) {
  const context = useContext(MatureConfirmationContext)
  if (!context) throw new Error('MatureConfirmationProvider is required')
  const { confirmedStoryIds, confirmStory, restoreStory } = context
  useEffect(() => {
    if (storyId) restoreStory(storyId)
  }, [storyId, restoreStory])
  return {
    isConfirmed: !!storyId && confirmedStoryIds.has(storyId),
    confirm: () => { if (storyId) confirmStory(storyId) },
  }
}
