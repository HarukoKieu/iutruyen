import type { Story } from '@/types/story'

export const createMockStory = (overrides?: Partial<Story>): Story => ({
  _id: 'mock-story-1',
  title: 'Tiêu Đề Truyện Mẫu',
  slug: 'tieu-de-truyen-mau',
  description: 'Mô tả truyện mẫu...',
  authorId: {
    _id: 'mock-author-1',
    username: 'mockauthor',
    displayName: 'Tác Giả Mẫu',
    role: 'author',
  },
  genreIds: [
    {
      _id: 'g-1',
      name: 'Tiên Hiệp',
      slug: 'tien-hiep',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ],
  tagIds: [],
  status: 'ongoing',
  moderationStatus: 'approved',
  contentWarning: 'none',
  chapterCount: 100,
  viewCount: 50000,
  followCount: 1200,
  ratingAverage: 4.8,
  ratingCount: 350,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
  ...overrides,
})

export const createMockComment = (overrides?: Partial<any>) => ({
  _id: 'mock-comment-1',
  storyId: 'mock-story-1',
  chapterId: null,
  userId: {
    _id: 'mock-user-1',
    displayName: 'Nguyễn Văn Đọc',
    username: 'nguyenvandoc',
    avatarUrl: '',
    role: 'user',
  },
  content: 'Truyện rất cuốn, mong tác giả ra chương đều tay!',
  likeCount: 5,
  likedByMe: false,
  replyCount: 0,
  isLocked: false,
  isDeleted: false,
  createdAt: '2026-08-25T10:00:00.000Z',
  updatedAt: '2026-08-25T10:00:00.000Z',
  ...overrides,
})

import type { AppNotification, NotificationType } from '@/types/notification'

export const createMockNotification = (overrides?: Partial<AppNotification>): AppNotification => ({
  _id: 'mock-notif-1',
  userId: 'mock-user-1',
  type: 'new_chapter' as NotificationType,
  title: 'Chương mới: Chương 10',
  message: 'Truyện yêu thích của bạn vừa cập nhật chương mới.',
  link: '/stories/tieu-de-truyen-mau/chapters/chuong-10',
  isRead: false,
  meta: { storyId: 'mock-story-1' },
  createdAt: '2026-09-10T10:00:00.000Z',
  updatedAt: '2026-09-10T10:00:00.000Z',
  ...overrides,
})

export const createMockReview = (overrides?: Partial<any>) => ({
  _id: 'mock-review-1',
  storyId: 'mock-story-1',
  userId: {
    _id: 'mock-user-2',
    displayName: 'Độc Giả Thâm Niên',
    username: 'docgiathamnien',
    avatarUrl: '',
    role: 'user',
  },
  content: 'Sau khi đọc 100 chương đầu, tôi đánh giá cao cách xây dựng thế giới của tác giả. Cốt truyện logic và không bị lặp lại lối mòn.',
  likeCount: 12,
  likedByMe: false,
  isDeleted: false,
  createdAt: '2026-08-26T12:00:00.000Z',
  updatedAt: '2026-08-26T12:00:00.000Z',
  ...overrides,
})

import type { ReportItem, ModerationLogItem } from '@/types/moderation'

export const createMockReport = (overrides?: Partial<ReportItem>): ReportItem => ({
  _id: 'mock-report-1',
  reporterId: {
    id: 'mock-user-1',
    _id: 'mock-user-1',
    username: 'reporter1',
    displayName: 'Người Báo Cáo',
    role: 'user',
  },
  targetType: 'story',
  targetId: 'mock-story-1',
  reason: 'inappropriate_content',
  description: 'Nội dung chứa yếu tố nhạy cảm vi phạm quy định cộng đồng.',
  status: 'pending',
  createdAt: '2026-09-12T10:00:00.000Z',
  updatedAt: '2026-09-12T10:00:00.000Z',
  ...overrides,
})

export const createMockModerationLog = (overrides?: Partial<ModerationLogItem>): ModerationLogItem => ({
  _id: 'mock-log-1',
  moderatorId: {
    id: 'mock-mod-1',
    _id: 'mock-mod-1',
    username: 'moderator1',
    displayName: 'Kiểm Duyệt Viên 1',
    role: 'moderator',
  },
  action: 'approve_story',
  targetType: 'story',
  targetId: 'mock-story-1',
  targetTitle: 'Tiêu Đề Truyện Mẫu',
  reason: 'Nội dung đạt chuẩn chất lượng',
  createdAt: '2026-09-12T11:00:00.000Z',
  ...overrides,
})

