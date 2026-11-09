import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import passport from 'passport'
import { env } from './config/env.js'
import { logger, morganStream } from './common/logger.js'
import { requestId } from './middlewares/requestId.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { ApiResponse } from './common/ApiResponse.js'
import { initPassport } from './modules/auth/oauth/passport.js'
import authRoutes from './modules/auth/auth.routes.js'
import usersRoutes from './modules/users/users.routes.js'
import genresRoutes from './modules/genres/genres.routes.js'
import tagsRoutes from './modules/tags/tags.routes.js'
import storiesRoutes from './modules/stories/stories.routes.js'
import chaptersRoutes from './modules/chapters/chapters.routes.js'
import crawlerJobRoutes from './modules/chapters/crawler-job.routes.js'
import readingHistoryRoutes from './modules/reading-history/reading-history.routes.js'
import bookmarksRoutes from './modules/bookmarks/bookmarks.routes.js'
import followsRoutes from './modules/follows/follows.routes.js'
import commentsRoutes from './modules/comments/comments.routes.js'
import ratingsReviewsRoutes from './modules/ratings-reviews/ratings-reviews.routes.js'
import notificationsRoutes from './modules/notifications/notifications.routes.js'
import moderationRoutes, { reportsPublicRouter } from './modules/moderation/moderation.routes.js'
import searchRoutes, { userSearchHistoryRouter } from './modules/search/search.routes.js'
import seoRoutes, { sitemapRootRouter } from './modules/seo/seo.routes.js'
import adminRoutes from './modules/admin/admin.routes.js'
import { adminController } from './modules/admin/admin.controller.js'
import { rateLimit } from './middlewares/rateLimit.js'
import { readiness } from './common/readiness.js'

const app = express()
// Trust only deployment-configured proxy addresses/subnets, never arbitrary headers.
if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY.split(',').map(value => value.trim()).filter(Boolean))

// Initialize Passport Strategies
initPassport()

// Request ID Tracing Middleware (Must be early)
app.use(requestId)

// HTTP Request Logging (Morgan -> Winston)
morgan.token('id', (req: express.Request) => req.id || '-')
morgan.token('safe-url', (req: express.Request) => req.originalUrl.split('?')[0])
const morganFormat =
  env.NODE_ENV === 'production'
    ? ':id :remote-addr - :method :safe-url HTTP/:http-version :status :res[content-length] - :response-time ms'
    : ':id :method :safe-url :status :response-time ms - :res[content-length]'

app.use(morgan(morganFormat, { stream: morganStream }))

// Security & Parsing Middlewares
const allowedOrigins = [
  env.CLIENT_URL,
  // Localhost origins are only allowed in non-production environments.
  // In production, only CLIENT_URL is whitelisted; the development fallback
  // below (NODE_ENV === 'development') is an additional safety net for local
  // dev without a configured CLIENT_URL.
  ...(env.NODE_ENV !== 'production'
    ? [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
        'http://localhost:3000',
      ]
    : []),
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      if (env.NODE_ENV === 'development') {
        return callback(null, true)
      }
      callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  })
)
app.use(helmet())
app.use(cookieParser())
app.use('/api/v1', (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next() })
app.use(express.json({ limit: '5mb' })) // Avatar/cover base64 ~700KB
app.use(express.urlencoded({ extended: true }))
app.use(passport.initialize())

// Health Check Routes
app.get('/health', readiness)
app.get('/api/v1/health', readiness)

// Module Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/admin', adminRoutes)
app.get('/api/v1/site-config', rateLimit({ prefix: 'site-config', windowSeconds: 60, maxRequests: 120 }), adminController.config)
app.use('/api/v1/users', usersRoutes)
app.use('/api/v1/genres', genresRoutes)
app.use('/api/v1/tags', tagsRoutes)
app.use('/api/v1/stories', storiesRoutes)
app.use('/api/v1', chaptersRoutes) // Provides /api/v1/stories/:storyId/chapters and /api/v1/chapters/:id
app.use('/api/v1', crawlerJobRoutes)
app.use('/api/v1/reading-history', readingHistoryRoutes)
app.use('/api/v1/bookmarks', bookmarksRoutes)
app.use('/api/v1', followsRoutes)
app.use('/api/v1/comments', commentsRoutes)
app.use('/api/v1/stories/:storyId', ratingsReviewsRoutes)
app.use('/api/v1/notifications', notificationsRoutes)
app.use('/api/v1/moderation', moderationRoutes)
app.use('/api/v1/reports', reportsPublicRouter)
app.use('/api/v1/search', searchRoutes)
app.use('/api/v1/users/me/search-history', userSearchHistoryRouter)

// Phase 8: SEO — public read-only endpoints (no auth, no side-effects)
app.use('/api/v1/seo', seoRoutes)
// robots.txt, sitemap.xml, /sitemaps/* served at root level
app.use('/', sitemapRootRouter)

// Global Error Handler (MUST be last)
app.use(errorHandler)

export default app
