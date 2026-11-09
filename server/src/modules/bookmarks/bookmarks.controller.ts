import { Request, Response } from 'express'
import { bookmarksService } from './bookmarks.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'

export const bookmarksController = {
  async createBookmark(req: Request, res: Response): Promise<void> {
    const bookmark = await bookmarksService.createBookmark(req.user!.id, req.body)
    ApiResponse.created(res, bookmark, 'Đã lưu bookmark')
  },

  async getUserBookmarks(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50
    const page = await bookmarksService.getUserBookmarksPage(req.user!.id, limit, req.query.cursor as string | undefined)
    ApiResponse.success(res, page.items, { meta: page.meta })
  },

  async deleteBookmark(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id)
    await bookmarksService.deleteBookmark(req.user!.id, id)
    ApiResponse.success(res, null, { message: 'Đã xóa bookmark' })
  },

  async checkBookmark(req: Request, res: Response): Promise<void> {
    const chapterId = String(req.params.chapterId)
    const bookmark = await bookmarksService.checkBookmark(req.user!.id, chapterId)
    ApiResponse.success(res, { bookmarked: !!bookmark, bookmark })
  },
}
