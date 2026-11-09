import { Request, Response } from 'express'
import { readingHistoryService } from './reading-history.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'

export const readingHistoryController = {
  async upsert(req: Request, res: Response): Promise<void> {
    const history = await readingHistoryService.upsert(req.user!.id, req.body)
    ApiResponse.success(res, history, { message: 'Cập nhật lịch sử đọc thành công' })
  },

  async getUserHistory(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20
    const page = await readingHistoryService.getUserHistoryPage(req.user!.id, limit, req.query.cursor as string | undefined)
    ApiResponse.success(res, page.items, { meta: page.meta })
  },
}
