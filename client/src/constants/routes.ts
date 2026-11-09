export const ROUTES = {
  // Public
  HOME: '/',
  STORIES: '/stories',
  STORY_DETAIL: (slug: string) => `/stories/${slug}`,
  STORY_CHAPTER: (storySlug: string, chapterSlug: string) => `/stories/${storySlug}/chapters/${chapterSlug}`,
  RANKING: '/ranking',
  CATEGORIES: '/categories',
  CATEGORY_DETAIL: (slug: string) => `/categories/${slug}`,
  TAGS: '/tags',
  TAG_DETAIL: (slug: string) => `/tags/${slug}`,
  SEARCH: '/search',
  AUTHOR_PUBLIC_PROFILE: (idOrUsername: string) => `/u/${idOrUsername}`,

  // Auth
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
  OAUTH_CALLBACK: '/oauth-callback',

  // User Area
  PROFILE: '/profile',
  LIBRARY: '/library',
  LIBRARY_HISTORY: '/library/history',
  LIBRARY_BOOKMARKS: '/library/bookmarks',
  NOTIFICATIONS: '/notifications',

  // Author Dashboard
  AUTHOR_DASHBOARD: '/author',
  AUTHOR_APPLY: '/author/apply',
  AUTHOR_STORIES: '/author/stories',
  AUTHOR_STORY_NEW: '/author/stories/new',
  AUTHOR_STORY_EDIT: (id: string) => `/author/stories/${id}/edit`,
  AUTHOR_CHAPTERS: (storyId: string) => `/author/stories/${storyId}/chapters`,
  AUTHOR_CHAPTER_NEW: (storyId: string) => `/author/stories/${storyId}/chapters/new`,
  AUTHOR_CHAPTER_EDIT: (storyId: string, chapterId: string) => `/author/stories/${storyId}/chapters/${chapterId}/edit`,

  // Moderator Dashboard
  MOD_DASHBOARD: '/mod',
  MOD_STORIES: '/mod/stories',
  MOD_CHAPTERS: '/mod/chapters',
  MOD_COMMENTS: '/mod/comments',
  MOD_REPORTS: '/mod/reports',
  MOD_REPORT_DETAIL: (id: string) => `/mod/reports/${id}`,
  MOD_HISTORY: '/mod/history',

  // Admin Dashboard
  ADMIN_DASHBOARD: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_AUTHORS: '/admin/authors',
  ADMIN_STORIES: '/admin/stories',
  ADMIN_CHAPTERS: '/admin/chapters',
  ADMIN_COMMENTS: '/admin/comments',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_AUDIT: '/admin/audit',
} as const
