import { Request, Response } from 'express'
import { storiesService } from './stories.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'
import { parseCursorPagination } from '../../common/pagination.js'
import {
  StoryQueryInput,
  AuthorStoriesQueryInput,
  RankingQueryInput,
} from './stories.validation.js'

export const getStories = async (req: Request, res: Response): Promise<void> => {
  const { cursor, limit } = parseCursorPagination(req)
  const query = req.query as unknown as StoryQueryInput
  const result = await storiesService.getStories({
    cursor,
    limit,
    genre: query.genre,
    tag: query.tag,
    status: query.status,
    sort: query.sort,
    q: query.q,
    author: query.author,
  })

  ApiResponse.success(res, result.stories, { meta: result.meta })
}

export const getAuthorStories = async (req: Request, res: Response): Promise<void> => {
  const { cursor, limit } = parseCursorPagination(req)
  const query = req.query as unknown as AuthorStoriesQueryInput
  const result = await storiesService.getAuthorStories(req.user!.id, {
    cursor,
    limit,
    status: query.status,
    sort: query.sort,
  })

  ApiResponse.success(res, result.stories, { meta: result.meta })
}

export const getStoryBySlug = async (req: Request, res: Response): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug
  const story = await storiesService.getStoryBySlug(slug as string, req.ip || req.socket.remoteAddress)
  ApiResponse.success(res, story)
}

export const createStory = async (req: Request, res: Response): Promise<void> => {
  const story = await storiesService.createStory(req.user!.id, req.body)
  ApiResponse.created(res, story, 'Tạo truyện mới thành công!')
}

export const updateStory = async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const updated = await storiesService.updateStory(id as string, req.body)
  ApiResponse.success(res, updated, { message: 'Cập nhật truyện thành công' })
}

export const deleteStory = async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  await storiesService.deleteStory(id as string)
  ApiResponse.success(res, null, { message: 'Xóa truyện thành công' })
}

export const getStoryById = async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const story = await storiesService.getStoryById(id as string)
  ApiResponse.success(res, story)
}

export const getStoryStats = async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const stats = await storiesService.getStoryStats(id as string)
  ApiResponse.success(res, stats)
}

export const getRanking = async (req: Request, res: Response): Promise<void> => {
  const { cursor, limit } = parseCursorPagination(req)
  const query = req.query as unknown as RankingQueryInput
  const result = await storiesService.getRanking({
    metric: query.metric,
    period: query.period,
    genre: query.genre,
    cursor,
    limit,
  })

  ApiResponse.success(res, result.stories, { meta: result.meta })
}

export const storiesController = {
  async getPublicCover(req: Request, res: Response) {
    const cover = await storiesService.getPublicCover(String(req.params.id))
    res.setHeader('Content-Type', cover.mime)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).end(cover.bytes)
  },
  getStories,
  getAuthorStories,
  getStoryBySlug,
  getStoryById,
  createStory,
  updateStory,
  deleteStory,
  getStoryStats,
  getRanking,
}
