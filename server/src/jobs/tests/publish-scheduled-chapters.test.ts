import { describe, expect, it, vi } from 'vitest'
vi.mock('../../repositories/chapter.repository.js', () => ({ chapterRepository: { findScheduledDue: vi.fn() } }))
vi.mock('../../repositories/story.repository.js', () => ({ storyRepository: {} }))
vi.mock('../../modules/notifications/notifications.service.js', () => ({ notificationsService: {} }))
import { chapterRepository } from '../../repositories/chapter.repository.js'
import { runPublishScheduledChaptersJob } from '../publish-scheduled-chapters.job.js'

describe('Scheduled job process lifecycle', () => {
  it('coalesces overlapping ticks, then allows the next scan', async () => {
    let release!: (value: []) => void
    vi.mocked(chapterRepository.findScheduledDue).mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const first = runPublishScheduledChaptersJob(), second = runPublishScheduledChaptersJob()
    expect(first).toBe(second)
    expect(chapterRepository.findScheduledDue).toHaveBeenCalledTimes(1)
    release([])
    await first
    vi.mocked(chapterRepository.findScheduledDue).mockResolvedValueOnce([])
    await runPublishScheduledChaptersJob()
    expect(chapterRepository.findScheduledDue).toHaveBeenCalledTimes(2)
  })
  it('releases the running flag after a scan error', async () => {
    vi.mocked(chapterRepository.findScheduledDue).mockRejectedValueOnce(new Error('DB offline'))
    await expect(runPublishScheduledChaptersJob()).rejects.toThrow('DB offline')
    vi.mocked(chapterRepository.findScheduledDue).mockResolvedValueOnce([])
    await expect(runPublishScheduledChaptersJob()).resolves.toBeUndefined()
  })
})
