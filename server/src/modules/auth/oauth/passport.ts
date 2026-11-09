import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt'
import { env } from '../../../config/env.js'
import { userRepository } from '../../../repositories/user.repository.js'
import { logger } from '../../../common/logger.js'
import { getPublicKey, TokenPayload } from '../../../common/jwt.js'
import { isAccountLocked, isSessionCurrent } from '../../../common/accountState.js'
import { AppError } from '../../../common/AppError.js'

export const initPassport = (): void => {
  // JWT Strategy (passport-jwt)
  const jwtOptions: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: getPublicKey(),
    algorithms: ['RS256'],
  }

  passport.use(
    'jwt',
    new JwtStrategy(jwtOptions, async (payload: TokenPayload, done) => {
      try {
        if (payload.type !== 'access') {
          return done(null, false, { message: 'Invalid token type' })
        }

        const user = await userRepository.findById(payload.id)
        if (!user) {
          return done(null, false, { message: 'User no longer exists' })
        }

        if (isAccountLocked(user) || !isSessionCurrent(user, payload)) {
          return done(null, false, { message: user.lockedReason || 'Tài khoản của bạn đã bị khóa' })
        }

        const authUser: Express.User = {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          authorStatus: user.authorStatus,
          isEmailVerified: user.isEmailVerified,
          isLocked: isAccountLocked(user),
          authVersion: user.authVersion ?? 0,
        }

        return done(null, authUser)
      } catch (error) {
        logger.error('JWT Passport authentication error:', error)
        return done(error, false)
      }
    })
  )

  // Google OAuth Strategy
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: env.GOOGLE_CALLBACK_URL || `http://localhost:${env.PORT}/api/v1/auth/google/callback`,
          scope: ['profile', 'email'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value
            if (!email) {
              return done(new Error('No email found in Google profile'), undefined)
            }

            let user = await userRepository.findByProvider('google', profile.id)
            if (!user) {
              // Never merge by mailbox: legacy local providerId links were not reauthenticated.
              if (await userRepository.findByEmail(email)) {
                return done(AppError.conflict('Email đã có tài khoản. Hãy đăng nhập bằng mật khẩu hoặc khôi phục tài khoản.', 'OAUTH_LINK_REQUIRED'), undefined)
              }
              const username = `user_${profile.id.slice(0, 8)}_${Date.now().toString().slice(-4)}`
              user = await userRepository.create({
                email,
                username,
                displayName: profile.displayName || profile.name?.givenName || 'Người dùng',
                avatarUrl: profile.photos?.[0]?.value,
                provider: 'google',
                providerId: profile.id,
                isEmailVerified: true,
              })
              logger.info(`New user registered via Google: ${email}`)
            }

            if (!user) {
              return done(new Error('Failed to create or update Google user'), undefined)
            }

            const authUser: Express.User = {
              id: user._id.toString(),
              email: user.email,
              username: user.username,
              displayName: user.displayName,
              role: user.role,
              authorStatus: user.authorStatus,
              isEmailVerified: user.isEmailVerified,
              isLocked: isAccountLocked(user),
              authVersion: user.authVersion ?? 0,
            }

            return done(null, authUser)
          } catch (error) {
            logger.error('Google OAuth error:', error)
            return done(error as Error, undefined)
          }
        }
      )
    )
  }

}
