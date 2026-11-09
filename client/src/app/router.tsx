import { lazy, Suspense } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'
import { PublicRoute } from '@/lib/seo/PublicRoute'
import { PrivateRoutePolicy } from '@/lib/seo/RoutePolicy'
import { loadPublicPage, seedPage } from '@/lib/seo/publicPage'
import { RequireRole } from '@/components/common/RequireRole'
import { ROUTES } from '@/constants/routes'

const LoadingFallback = () => (
  <div role="status" className="flex min-h-dvh items-center justify-center gap-3 bg-background text-foreground">
    <div aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    <span className="sr-only">Đang tải trang…</span>
  </div>
)

import HomePage from './pages/HomePage'
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const VerifyEmailPage = lazy(() => import('@/features/auth/pages/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))
const OAuthCallbackPage = lazy(() => import('@/features/auth/pages/OAuthCallbackPage'))
const ProfilePage = lazy(() => import('@/features/user-profile/pages/ProfilePage'))

// Phase 2: Story Management
import StoryListPage from '@/features/stories/pages/StoryListPage'
import StoryDetailPage from '@/features/stories/pages/StoryDetailPage'
import RankingPage from '@/features/stories/pages/RankingPage'
const AuthorStoriesPage = lazy(() => import('@/features/author-dashboard/pages/AuthorStoriesPage'))
const AuthorApplicationPage = lazy(() => import('@/features/author-dashboard/pages/AuthorApplicationPage'))
const StoryFormPage = lazy(() => import('@/features/author-dashboard/pages/StoryFormPage'))

// Phase 3: Chapter Management & Reader
import ChapterReaderPage from '@/features/reader/pages/ChapterReaderPage'
const AuthorChapterListPage = lazy(() => import('@/features/author-dashboard/pages/AuthorChapterListPage'))
const ChapterFormPage = lazy(() => import('@/features/author-dashboard/pages/ChapterFormPage'))
const CrawlerImportPage = lazy(() => import('@/features/author-dashboard/pages/CrawlerImportPage'))
const CrawlerJobsPage = lazy(() => import('@/features/author-dashboard/pages/CrawlerJobsPage'))

// Phase 5: Library & Notifications
const NotificationPage = lazy(() => import('@/features/notifications/pages/NotificationPage'))
const LibraryPage = lazy(() => import('@/features/follows-bookmarks/pages/LibraryPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// Phase 6: Moderation & Reports
const ModerationLayout = lazy(() => import('@/features/moderation/components/ModerationLayout'))
const ModerationQueuePage = lazy(() => import('@/features/moderation/pages/ModerationQueuePage'))
const ReportsListPage = lazy(() => import('@/features/moderation/pages/ReportsListPage'))
const ReportDetailPage = lazy(() => import('@/features/moderation/pages/ReportDetailPage'))
const ModerationHistoryPage = lazy(() => import('@/features/moderation/pages/ModerationHistoryPage'))

// Phase 7: Search & Filter
const SearchPage = lazy(() => import('@/features/search/pages/SearchPage'))
const AdminLayout = lazy(() => import('@/features/admin/components/AdminLayout'))
const AdminOverviewPage = lazy(() => import('@/features/admin/pages/AdminOverviewPage'))
const AdminUsersPage = lazy(() => import('@/features/admin/pages/AdminUsersPage'))
const AdminStoriesPage = lazy(() => import('@/features/admin/pages/AdminStoriesPage'))
const AdminConfigPage = lazy(() => import('@/features/admin/pages/AdminConfigPage'))
const AdminAuditPage = lazy(() => import('@/features/admin/pages/AdminAuditPage'))
const AdminBackupsPage = lazy(() => import('@/features/admin/pages/AdminBackupsPage'))

const definitions: RouteObject[] = [
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <HomePage />
      </Suspense>
    ),
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    path: '/verify-email',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <VerifyEmailPage />
      </Suspense>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ForgotPasswordPage />
      </Suspense>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ResetPasswordPage />
      </Suspense>
    ),
  },
  {
    path: '/oauth-callback',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <OAuthCallbackPage />
      </Suspense>
    ),
  },
  {
    path: '/profile',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ProfilePage />
      </Suspense>
    ),
  },
  // Phase 2: Story routes
  {
    path: '/stories',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <StoryListPage />
      </Suspense>
    ),
  },
  {
    path: '/ranking',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <RankingPage />
      </Suspense>
    ),
  },
  {
    path: '/stories/:slug',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <StoryDetailPage />
      </Suspense>
    ),
  },
  {
    path: ROUTES.AUTHOR_APPLY,
    element: (
      <RequireRole roles={['user', 'author', 'moderator', 'admin']}>
        <Suspense fallback={<LoadingFallback />}>
          <AuthorApplicationPage />
        </Suspense>
      </RequireRole>
    ),
  },
  {
    path: '/author/stories',
    element: (
      <RequireRole roles={['author', 'admin']}>
        <Suspense fallback={<LoadingFallback />}>
          <AuthorStoriesPage />
        </Suspense>
      </RequireRole>
    ),
  },
  {
    path: '/author/stories/new',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <StoryFormPage />
      </Suspense>
    ),
  },
  {
    path: '/author/stories/:id/edit',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <StoryFormPage />
      </Suspense>
    ),
  },
  // Phase 3: Chapter & Reader routes
  {
    path: '/author/crawl',
    element: (
      <RequireRole roles={['author', 'admin']}>
        <Suspense fallback={<LoadingFallback />}><CrawlerJobsPage /></Suspense>
      </RequireRole>
    ),
  },
  {
    path: '/author/stories/:storyId/crawl',
    element: (
      <RequireRole roles={['author', 'admin']}>
        <Suspense fallback={<LoadingFallback />}><CrawlerImportPage /></Suspense>
      </RequireRole>
    ),
  },
  {
    path: '/stories/:slug/chapters/:chapterSlug',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ChapterReaderPage />
      </Suspense>
    ),
  },
  {
    path: '/author/stories/:storyId/chapters',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <AuthorChapterListPage />
      </Suspense>
    ),
  },
  {
    path: '/author/stories/:storyId/chapters/new',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ChapterFormPage />
      </Suspense>
    ),
  },
  {
    path: '/author/stories/:storyId/chapters/:chapterId/edit',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ChapterFormPage />
      </Suspense>
    ),
  },
  // Phase 5: Notifications
  {
    path: '/notifications',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <NotificationPage />
      </Suspense>
    ),
  },
  // Phase 5: Library & Bookmarks routes (Tủ sách cá nhân)
  {
    path: '/library',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <LibraryPage />
      </Suspense>
    ),
  },
  {
    path: '/profile/library',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <LibraryPage />
      </Suspense>
    ),
  },
  {
    path: '/library/following',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <LibraryPage defaultTab="following" />
      </Suspense>
    ),
  },
  {
    path: '/library/bookmarks',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <LibraryPage defaultTab="bookmarks" />
      </Suspense>
    ),
  },
  {
    path: '/library/history',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <LibraryPage defaultTab="history" />
      </Suspense>
    ),
  },
  {
    path: '/history',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <LibraryPage defaultTab="history" />
      </Suspense>
    ),
  },
  // Phase 7: Search
  {
    path: '/search',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <SearchPage />
      </Suspense>
    ),
  },
  // Phase 6: Moderation & Reports
  {
    path: '/mod',
    element: (
      <RequireRole roles={['moderator', 'admin']}>
        <Suspense fallback={<LoadingFallback />}>
          <ModerationLayout />
        </Suspense>
      </RequireRole>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/mod/stories" replace />,
      },
      {
        path: 'stories',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ModerationQueuePage defaultType="stories" />
          </Suspense>
        ),
      },
      {
        path: 'chapters',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ModerationQueuePage defaultType="chapters" />
          </Suspense>
        ),
      },
      {
        path: 'comments',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ModerationQueuePage defaultType="comments" />
          </Suspense>
        ),
      },
      {
        path: 'reports',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ReportsListPage />
          </Suspense>
        ),
      },
      {
        path: 'reports/:id',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ReportDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'history',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ModerationHistoryPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '/admin',
    element: <RequireRole roles={['admin']}><Suspense fallback={<LoadingFallback />}><AdminLayout /></Suspense></RequireRole>,
    children: [
      { index: true, element: <Suspense fallback={<LoadingFallback />}><AdminOverviewPage /></Suspense> },
      { path: 'users', element: <Suspense fallback={<LoadingFallback />}><AdminUsersPage key="users" /></Suspense> },
      { path: 'authors', element: <Suspense fallback={<LoadingFallback />}><AdminUsersPage key="authors" mode="authors" /></Suspense> },
      { path: 'moderators', element: <Suspense fallback={<LoadingFallback />}><AdminUsersPage key="moderators" mode="moderators" /></Suspense> },
      { path: 'stories', element: <Suspense fallback={<LoadingFallback />}><AdminStoriesPage /></Suspense> },
      { path: 'config', element: <Suspense fallback={<LoadingFallback />}><AdminConfigPage /></Suspense> },
      { path: 'audit', element: <Suspense fallback={<LoadingFallback />}><AdminAuditPage /></Suspense> },
      { path: 'backups', element: <Suspense fallback={<LoadingFallback />}><AdminBackupsPage /></Suspense> },
    ],
  },
  // Catch-all 404
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
]

export function createRoutes(client: QueryClient, fetcher: (path: string) => Promise<Response>): RouteObject[] {
  return definitions.map((route, index) => {
    const path = route.path ?? ''
    const publicRoute = ['/', '/stories', '/ranking', '/stories/:slug', '/stories/:slug/chapters/:chapterSlug', '*'].includes(path)
    return { ...route, id: String(index),
      element: publicRoute ? <PublicRoute key={path}>{route.element}</PublicRoute> : <><PrivateRoutePolicy />{route.element}</>,
      ...(publicRoute ? { loader: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const page = await loadPublicPage(url, fetcher)
        if (!url.search) seedPage(client, page, url.pathname)
        else if (url.pathname !== '/stories' && url.pathname !== '/ranking') seedPage(client, page, url.pathname)
        return page
      } } : {}),
    }
  })
}
