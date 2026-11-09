import { Request, Response } from 'express'
import { tagsService } from './tags.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'

export const getAllTags = async (req: Request, res: Response): Promise<void> => {
  const q = req.query.q as string | undefined
  const tags = await tagsService.getAllTags(q)
  ApiResponse.success(res, tags)
}

export const tagsController = {
  getAllTags,
}
