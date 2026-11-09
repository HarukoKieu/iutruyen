import { Request, Response } from 'express'
import { searchService } from './search.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'
import { SearchStoriesQuery } from './search.validation.js'
import { AuthUser } from '../../middlewares/authenticate.js'

export const searchStories = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as SearchStoriesQuery
  const userId = (req.user as AuthUser | undefined)?.id
  const result = await searchService.searchStories(query, userId)

  ApiResponse.success(res, result.stories, {
    message: 'Tìm kiếm truyện thành công',
    meta: result.meta,
  })
}

export const getSuggestions = async (req: Request, res: Response): Promise<void> => {
  const q = (req.query.q as string) || ''
  const userId = (req.user as AuthUser | undefined)?.id
  const result = await searchService.getSuggestions(q, userId)

  ApiResponse.success(res, result, {
    message: 'Lấy gợi ý tìm kiếm thành công',
  })
}

export const getSearchHistory = async (req: Request, res: Response): Promise<void> => {
  const userId = (req.user as AuthUser).id
  const history = await searchService.getUserSearchHistory(userId)

  ApiResponse.success(res, history, {
    message: 'Lấy lịch sử tìm kiếm thành công',
  })
}

export const deleteSearchHistory = async (req: Request, res: Response): Promise<void> => {
  const userId = (req.user as AuthUser).id
  const q = req.query.q as string | undefined
  const result = await searchService.deleteUserSearchHistory(userId, q)

  ApiResponse.success(res, result, {
    message: result.message,
  })
}

export const searchController = {
  searchStories,
  getSuggestions,
  getSearchHistory,
  deleteSearchHistory,
}
