import { Router } from 'express'
import { genresController } from './genres.controller.js'
import { asyncHandler } from '../../common/asyncHandler.js'

const router = Router()

router.get('/', asyncHandler(genresController.getAllGenres))

export default router
