import { Request, Response } from 'express'
import { followsService } from './follows.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'

export const followsController = {
  async toggleFollow(req: Request, res: Response): Promise<void> {
    const storyId = String(req.params.storyId)
    const result = await followsService.toggleFollow(req.user!.id, storyId, req.user)
    ApiResponse.success(res, result, {
      message: result.isFollowing ? 'Đã thêm truyện vào tủ theo dõi' : 'Đã bỏ theo dõi truyện',
    })
  },

  async unfollow(req: Request, res: Response): Promise<void> {
    const storyId = String(req.params.storyId)
    const result = await followsService.unfollow(req.user!.id, storyId)
    ApiResponse.success(res, result, {
      message: 'Đã bỏ theo dõi truyện',
    })
  },

  async checkFollow(req: Request, res: Response): Promise<void> {
    const storyId = String(req.params.storyId)
    const result = await followsService.checkFollow(req.user!.id, storyId)
    ApiResponse.success(res, result)
  },

  async getUserFollows(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50
    const page = await followsService.getUserFollowsPage(req.user!.id, limit, req.query.cursor as string | undefined)
    ApiResponse.success(res, page.items, { meta: page.meta })
  },
}
