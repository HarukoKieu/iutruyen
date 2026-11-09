import { Request, Response } from 'express'
import { commentsService } from './comments.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'
import type {
  CreateCommentDto,
  UpdateCommentDto,
  QueryCommentsDto,
  QueryRepliesDto,
} from './comments.validation.js'

export const commentsController = {
  async getComments(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as QueryCommentsDto
    const result = await commentsService.getComments(query, req.user?.id)
    ApiResponse.success(res, result.items, {
      meta: {
        limit: Number(query.limit) || 20,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    })
  },

  async getReplies(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as QueryRepliesDto
    const result = await commentsService.getReplies(String(req.params.id), query, req.user?.id)
    ApiResponse.success(res, result.items, {
      meta: {
        limit: Number(query.limit) || 10,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    })
  },

  async createComment(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateCommentDto
    const comment = await commentsService.createComment(req.user!.id, body)
    ApiResponse.success(res, comment, { statusCode: 201, message: 'Đã đăng bình luận' })
  },

  async updateComment(req: Request, res: Response): Promise<void> {
    const { content } = req.body as UpdateCommentDto
    const comment = await commentsService.updateComment(String(req.params.id), req.user!.id, content)
    ApiResponse.success(res, comment, { message: 'Đã cập nhật bình luận' })
  },

  async deleteComment(req: Request, res: Response): Promise<void> {
    await commentsService.deleteComment(String(req.params.id), req.user!.id, req.user!.role, req.user!.authorStatus)
    ApiResponse.success(res, null, { message: 'Đã xóa bình luận' })
  },

  async likeComment(req: Request, res: Response): Promise<void> {
    const result = await commentsService.toggleLike(String(req.params.id), req.user!.id, req.user)
    ApiResponse.success(res, result, { message: 'Cập nhật lượt thích thành công' })
  },

  async lockComment(req: Request, res: Response): Promise<void> {
    const result = await commentsService.toggleLock(String(req.params.id), req.user!.id, req.user!.role, req.user!.authorStatus)
    ApiResponse.success(res, result, {
      message: result.isLocked ? 'Đã khoá bình luận' : 'Đã mở khoá bình luận',
    })
  },
}
