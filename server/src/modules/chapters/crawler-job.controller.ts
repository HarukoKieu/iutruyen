import type { Request, Response } from 'express'
import { ApiResponse } from '../../common/ApiResponse.js'
import { crawlerJobService } from './crawler-job.service.js'
import type { CrawlerJobsQuery, CrawlerTasksQuery, CrawlerTargetsQuery } from './crawler-job.validation.js'

export const crawlerJobController = {
  async targets(req: Request, res: Response) {
    const { items, meta } = await crawlerJobService.targets(req.user!.id, req.query as unknown as CrawlerTargetsQuery)
    return ApiResponse.success(res, items, { meta })
  },
  async create(req: Request, res: Response) {
    return ApiResponse.success(res, await crawlerJobService.create(req.user!.id, req.body), { statusCode: 202 })
  },
  async list(req: Request, res: Response) {
    const { items, meta } = await crawlerJobService.list(req.user!.id, req.query as unknown as CrawlerJobsQuery)
    return ApiResponse.success(res, items, { meta })
  },
  async detail(req: Request, res: Response) {
    return ApiResponse.success(res, await crawlerJobService.detail(req.user!.id, String(req.params.jobId), req.user!.role === 'admin'))
  },
  async tasks(req: Request, res: Response) {
    const { items, meta } = await crawlerJobService.tasks(req.user!.id, String(req.params.jobId), req.query as unknown as CrawlerTasksQuery, req.user!.role === 'admin')
    return ApiResponse.success(res, items, { meta })
  },
  async control(req: Request, res: Response) {
    return ApiResponse.success(res, await crawlerJobService.control(req.user!.id, String(req.params.jobId), req.body, req.user!.role === 'admin'))
  },
}
