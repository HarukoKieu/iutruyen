import { chapterRepository } from '../repositories/chapter.repository.js'
import { storyRepository } from '../repositories/story.repository.js'
import { notificationsService } from '../modules/notifications/notifications.service.js'
import { logger } from '../common/logger.js'
import { isPublicStory } from '../common/contentVisibility.js'
let running: Promise<void> | undefined
/** Bounded scan plus compare-and-set allows multiple workers without duplicate claims. */
export const runPublishScheduledChaptersJob = (): Promise<void> => {
  if (running) return running
  running = publishDue().finally(() => { running = undefined })
  return running
}
async function publishDue(): Promise<void> {
  const now = new Date()
  let afterId: string | undefined
  for (let batch = 0; batch < 10; batch++) {
    const candidates = await chapterRepository.findScheduledDue(now, afterId)
    if (!candidates.length) return
    for (const candidate of candidates) {
      afterId = String(candidate._id)
      const storyId = String(candidate.storyId)
      try {
        const story = await storyRepository.findById(storyId)
        if (!story || !isPublicStory(story)) continue
        const chapter = await chapterRepository.claimScheduled(candidate._id, now)
        if (!chapter) continue
        await notificationsService.notifyNewChapter(story, chapter)
      } catch (error) { logger.error('Scheduled publication failed', { chapterId: afterId, error }) }
    }
    if (candidates.length < 100) return
  }
}
export const startScheduledPublishingCron = (intervalMs = 60000): NodeJS.Timeout => {
  const run = () => { void runPublishScheduledChaptersJob().catch(error => logger.error('Scheduled publication job failed', error)) }
  run()
  return setInterval(run, intervalMs)
}
export const waitForScheduledPublishing = async (): Promise<void> => { await running }
