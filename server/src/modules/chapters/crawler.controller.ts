import type { Request, Response } from 'express'
import { ApiResponse } from '../../common/ApiResponse.js'
import { crawlerService } from './crawler.service.js'

export const crawlerController = {
  async metadata(req: Request, res: Response) {
    return ApiResponse.success(res, await crawlerService.metadata(req.user!.id, req.body.url))
  },
  async catalog(req: Request, res: Response) {
    const { nextCursor, hasNextPage, ...data } = await crawlerService.catalog(req.user!.id, String(req.params.storyId), req.body.url, req.body.cursor)
    return ApiResponse.success(res, data, { meta: { nextCursor, hasNextPage, limit: 50 } })
  },
  async preview(req: Request, res: Response) {
    return ApiResponse.success(res, await crawlerService.preview(req.user!.id, String(req.params.storyId), req.body.url))
  },
  async importChapter(req: Request, res: Response) {
    const result = await crawlerService.importChapter(req.user!.id, String(req.params.storyId), req.body)
    return ApiResponse.success(res, result, { statusCode: result.alreadyImported ? 200 : 201 })
  },
}
