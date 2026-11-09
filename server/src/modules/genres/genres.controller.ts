import { Request, Response } from 'express'
import { genresService } from './genres.service.js'
import { ApiResponse } from '../../common/ApiResponse.js'

export const getAllGenres = async (_req: Request, res: Response): Promise<void> => {
  const genres = await genresService.getAllGenres()
  ApiResponse.success(res, genres)
}

export const genresController = {
  getAllGenres,
}
