import { Router } from 'express'
import { z } from 'zod'
import { tagsController } from './tags.controller.js'
import { asyncHandler } from '../../common/asyncHandler.js'
import { validate } from '../../middlewares/validate.js'

const router = Router()

const tagsQuerySchema = z.object({
  q: z.string().max(100).optional(),
})

router.get('/', validate({ query: tagsQuerySchema }), asyncHandler(tagsController.getAllTags))

export default router
