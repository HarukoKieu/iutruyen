import { Router } from 'express'
import { usersController } from './users.controller.js'
import {
  updateProfileSchema,
  updateAvatarSchema,
  changePasswordSchema,
  changeEmailSchema,
  publicProfileParamsSchema,
} from './users.validation.js'
import { validate } from '../../middlewares/validate.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { asyncHandler } from '../../common/asyncHandler.js'
import { rateLimit } from '../../middlewares/rateLimit.js'

const router = Router()

router.get('/me', authenticate, asyncHandler(usersController.getMe))

router.patch(
  '/me',
  authenticate,
  validate({ body: updateProfileSchema }),
  asyncHandler(usersController.updateMe)
)

router.patch(
  '/me/avatar',
  authenticate,
  validate({ body: updateAvatarSchema }),
  asyncHandler(usersController.updateAvatar)
)

router.patch(
  '/me/password',
  authenticate,
  rateLimit({
    windowSeconds: 3600,
    maxRequests: 5,
    prefix: 'change-pwd',
    keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  }),
  validate({ body: changePasswordSchema }),
  asyncHandler(usersController.changePassword)
)

router.patch(
  '/me/email',
  authenticate,
  rateLimit({ windowSeconds: 3600, maxRequests: 5, prefix: 'change-email', keyGenerator: req => req.user!.id }),
  validate({ body: changeEmailSchema }),
  asyncHandler(usersController.changeEmail)
)

router.post(
  '/me/become-author',
  authenticate,
  asyncHandler(usersController.becomeAuthor)
)

router.get(
  '/:id/public-profile',
  validate({ params: publicProfileParamsSchema }),
  asyncHandler(usersController.getPublicProfile)
)

export default router
