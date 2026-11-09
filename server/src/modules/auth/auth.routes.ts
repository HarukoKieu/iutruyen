import { Router, Request, Response, NextFunction } from 'express'
import passport from 'passport'
import { authController } from './auth.controller.js'
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validation.js'
import { validate } from '../../middlewares/validate.js'
import { authenticate } from '../../middlewares/authenticate.js'
import { asyncHandler } from '../../common/asyncHandler.js'
import { rateLimit } from '../../middlewares/rateLimit.js'
import { env } from '../../config/env.js'
import { beginGoogleOAuth, verifyGoogleOAuthState } from './oauth/state.js'

const router = Router()

const requireGoogleConfig = (_req: Request, res: Response, next: NextFunction) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${env.CLIENT_URL}/login?error=google_not_configured`)
  }
  next()
}


// Local Authentication Routes
router.post(
  '/register',
  rateLimit({ windowSeconds: 3600, maxRequests: 10, prefix: 'register' }),
  validate({ body: registerSchema }),
  asyncHandler(authController.register)
)

router.post(
  '/login',
  rateLimit({ windowSeconds: 60, maxRequests: 10, prefix: 'login' }),
  validate({ body: loginSchema }),
  asyncHandler(authController.login)
)

router.post('/refresh', asyncHandler(authController.refresh))

router.post('/logout', authenticate, asyncHandler(authController.logout))

router.post(
  '/verify-email',
  validate({ body: verifyEmailSchema }),
  asyncHandler(authController.verifyEmail)
)

router.post(
  '/forgot-password',
  rateLimit({ windowSeconds: 300, maxRequests: 5, prefix: 'forgot-pwd' }),
  validate({ body: forgotPasswordSchema }),
  asyncHandler(authController.forgotPassword)
)

router.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  asyncHandler(authController.resetPassword)
)

// Google OAuth
router.get(
  '/google',
  requireGoogleConfig,
  rateLimit({ windowSeconds: 60, maxRequests: 10, prefix: 'oauth-start' }),
  asyncHandler(beginGoogleOAuth)
)

router.get(
  '/google/callback',
  requireGoogleConfig,
  asyncHandler(verifyGoogleOAuthState),
  passport.authenticate('google', { session: false, failureRedirect: `${env.CLIENT_URL}/login?error=google_failed` }),
  asyncHandler(authController.oauthCallback)
)

export default router
