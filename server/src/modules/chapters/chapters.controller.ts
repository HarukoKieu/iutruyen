import { Request, Response } from 'express'
import { chaptersService } from './chapters.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'
import { chapterListQuerySchema } from './chapters.validation.js'

export const chaptersController = {
  async getChaptersByStory(req: Request, res: Response): Promise<void> {
    const storyId = String(req.params.storyId)
    const result = await chaptersService.getChaptersByStory(storyId, req.user, chapterListQuerySchema.parse(req.query))
    ApiResponse.success(res, result.items, { meta: result.meta })
  },

  async getChapterBySlug(req: Request, res: Response): Promise<void> {
    const storyId = String(req.params.storyId)
    const slug = String(req.params.slug)
    const result = await chaptersService.getChapterBySlug(storyId, slug, req.user, req.ip || req.socket.remoteAddress)
    ApiResponse.success(res, result)
  },

  async createChapter(req: Request, res: Response): Promise<void> {
    const storyId = String(req.params.storyId)
    const chapter = await chaptersService.createChapter(storyId, req.body)
    ApiResponse.created(res, chapter, 'Tạo chương mới thành công')
  },

  async updateChapter(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id)
    const chapter = await chaptersService.updateChapter(id, req.body)
    ApiResponse.success(res, chapter, { message: 'Cập nhật chương thành công' })
  },

  async deleteChapter(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id)
    await chaptersService.deleteChapter(id)
    ApiResponse.success(res, null, { message: 'Xóa chương thành công' })
  },

  async getChapterPreview(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id)
    const chapter = await chaptersService.getChapterPreview(id)
    ApiResponse.success(res, chapter)
  },
}
