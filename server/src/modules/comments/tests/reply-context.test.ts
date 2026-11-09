import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commentsService } from '../comments.service.js'
import { commentRepository } from '../../../repositories/comment.repository.js'
import { storyRepository } from '../../../repositories/story.repository.js'
vi.mock('../../../repositories/comment.repository.js')
vi.mock('../../../repositories/story.repository.js')
const storyId = '123456789012345678901234', parentId = '123456789012345678901235'
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(storyRepository.findById).mockResolvedValue({ moderationStatus: 'approved' } as never)
})
describe('reply consistency', () => {
  it.each([
    { storyId: '123456789012345678901239', chapterId: null },
    { storyId, chapterId: '123456789012345678901239' },
  ])('rejects cross-context parent %j', async context => {
    vi.mocked(commentRepository.findById).mockResolvedValue({ _id: parentId, ...context } as never)
    await expect(commentsService.createComment('user', { storyId, parentId, content: 'Một bình luận hợp lệ' })).rejects.toMatchObject({ code: 'COMMENT_CONTEXT_MISMATCH' })
    expect(commentRepository.create).not.toHaveBeenCalled()
  })
  it('rejects replying through a child of a locked root', async () => {
    vi.mocked(commentRepository.findById).mockResolvedValueOnce({ _id: parentId, storyId, parentId: '123456789012345678901239' } as never)
      .mockResolvedValueOnce({ _id: '123456789012345678901239', storyId, isLocked: true } as never)
    await expect(commentsService.createComment('user', { storyId, parentId, content: 'Một bình luận hợp lệ' })).rejects.toMatchObject({ statusCode: 403 })
  })
})
