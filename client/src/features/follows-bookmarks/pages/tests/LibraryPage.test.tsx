import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { LibraryPage } from '../LibraryPage'
import { useAuthStore } from '@/features/auth/store/authStore'
import * as followsApi from '@/features/follows-bookmarks/api/follows.api'
import * as bookmarksApi from '@/features/follows-bookmarks/api/bookmarks.api'
import * as readingHistoryApi from '@/features/follows-bookmarks/api/reading-history.api'

vi.mock('@/features/follows-bookmarks/api/follows.api')
vi.mock('@/features/follows-bookmarks/api/bookmarks.api')
vi.mock('@/features/follows-bookmarks/api/reading-history.api')
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mkClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

const renderPage = (client: QueryClient, initialTab?: 'following' | 'bookmarks' | 'history') =>
  render(
    <MemoryRouter initialEntries={['/library']}>
      <QueryClientProvider client={client}>
        <LibraryPage defaultTab={initialTab} />
      </QueryClientProvider>
    </MemoryRouter>
  )

describe('LibraryPage', () => {
  beforeEach(() => {
    vi.mocked(followsApi.followsApi.getPage).mockImplementation(async limit => ({ items: await followsApi.followsApi.getUserFollows(limit), nextCursor: null }))
    vi.mocked(bookmarksApi.bookmarksApi.getPage).mockImplementation(async () => ({ items: await bookmarksApi.bookmarksApi.getUserBookmarks(), nextCursor: null }))
    vi.mocked(readingHistoryApi.readingHistoryApi.getPage).mockImplementation(async limit => ({ items: await readingHistoryApi.readingHistoryApi.getUserHistory(limit), nextCursor: null }))
    useAuthStore.setState({
      user: {
        id: 'u-1',
        email: 'test@test.com',
        username: 'test',
        displayName: 'Test User',
        role: 'user',
        isEmailVerified: true,
      },
      accessToken: 'token-abc',
      isAuthenticated: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  })

  it('renders login prompt when unauthenticated', () => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    const client = mkClient()

    renderPage(client)

    expect(screen.getByText('Vui lòng đăng nhập để đồng bộ truyện đang theo dõi, dấu trang và lịch sử đọc trên mọi thiết bị.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Đăng nhập ngay/i })).toBeInTheDocument()
  })

  it('renders followed stories in the following tab', async () => {
    const client = mkClient()
    const mockFollows = [
      {
        _id: 'f-1',
        userId: 'u-1',
        storyId: {
          _id: 's-1',
          title: 'Đấu Phá Thương Khung',
          slug: 'dau-pha-thuong-khung',
          authorId: { _id: 'a-1', displayName: 'Thiên Tằm Thổ Đậu' },
          chapterCount: 1600,
          status: 'completed',
        } as any,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ]

    vi.mocked(followsApi.followsApi.getUserFollows).mockResolvedValue(mockFollows)
    vi.mocked(bookmarksApi.bookmarksApi.getUserBookmarks).mockResolvedValue([])
    vi.mocked(readingHistoryApi.readingHistoryApi.getUserHistory).mockResolvedValue([])

    renderPage(client, 'following')

    expect(await screen.findByText('Đấu Phá Thương Khung')).toBeInTheDocument()
    expect(screen.getByText('Thiên Tằm Thổ Đậu')).toBeInTheDocument()
    expect(screen.getByText('1600 chương')).toBeInTheDocument()
  })

  it('switches between tabs and shows bookmarks', async () => {
    const user = userEvent.setup()
    const client = mkClient()

    const mockBookmarks = [
      {
        _id: 'b-1',
        userId: 'u-1',
        chapterId: {
          _id: 'c-1',
          title: 'Chương 100: Đại Chiến',
          slug: 'chuong-100',
          order: 100,
          storyId: {
            _id: 's-1',
            title: 'Phàm Nhân Tu Tiên',
            slug: 'pham-nhan-tu-tien',
          },
        },
        note: 'Đoạn này quá hay',
        createdAt: '2026-09-05T00:00:00.000Z',
      },
    ]

    vi.mocked(followsApi.followsApi.getUserFollows).mockResolvedValue([])
    vi.mocked(bookmarksApi.bookmarksApi.getUserBookmarks).mockResolvedValue(mockBookmarks)
    vi.mocked(readingHistoryApi.readingHistoryApi.getUserHistory).mockResolvedValue([])

    renderPage(client)

    const bookmarksTab = await screen.findByRole('button', { name: /Dấu trang/i })
    await user.click(bookmarksTab)

    expect(await screen.findByText(/Phàm Nhân Tu Tiên — Chương 100: Đại Chiến/i)).toBeInTheDocument()
    expect(screen.getByText(/"Đoạn này quá hay"/i)).toBeInTheDocument()
  })

  it('removes the selected followed story using its story ID', async () => {
    const user = userEvent.setup()
    vi.mocked(followsApi.followsApi.getUserFollows).mockResolvedValue([{
      _id: 'follow', userId: 'u-1', storyId: { _id: 'selected-story', title: 'Truyện đang đọc', slug: 'truyen-dang-doc' } as any,
      createdAt: '', updatedAt: '',
    }])
    vi.mocked(followsApi.followsApi.toggleFollow).mockResolvedValue({ isFollowing: false, followCount: 0 })
    vi.mocked(bookmarksApi.bookmarksApi.getUserBookmarks).mockResolvedValue([])
    vi.mocked(readingHistoryApi.readingHistoryApi.getUserHistory).mockResolvedValue([])
    renderPage(mkClient())
    await user.click(await screen.findByRole('button', { name: 'Bỏ theo dõi Truyện đang đọc' }))
    await waitFor(() => expect(followsApi.followsApi.toggleFollow).toHaveBeenCalledWith('selected-story'))
  })

  it('filters items based on search query', async () => {
    const user = userEvent.setup()
    const client = mkClient()

    const mockFollows = [
      {
        _id: 'f-1',
        userId: 'u-1',
        storyId: {
          _id: 's-1',
          title: 'Toàn Chức Cao Thủ',
          slug: 'toan-chuc-cao-thu',
          authorId: { _id: 'a-1', displayName: 'Hồ Điệp Lam' },
          chapterCount: 1700,
        } as any,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        _id: 'f-2',
        userId: 'u-1',
        storyId: {
          _id: 's-2',
          title: 'Vũ Động Càn Khôn',
          slug: 'vu-dong-can-khon',
          authorId: { _id: 'a-2', displayName: 'Thiên Tằm Thổ Đậu' },
          chapterCount: 1300,
        } as any,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ]

    vi.mocked(followsApi.followsApi.getUserFollows).mockResolvedValue(mockFollows)
    vi.mocked(bookmarksApi.bookmarksApi.getUserBookmarks).mockResolvedValue([])
    vi.mocked(readingHistoryApi.readingHistoryApi.getUserHistory).mockResolvedValue([])

    renderPage(client, 'following')

    expect(await screen.findByText('Toàn Chức Cao Thủ')).toBeInTheDocument()
    expect(screen.getByText('Vũ Động Càn Khôn')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText('Lọc các mục đã tải…')
    await user.type(searchInput, 'Toàn Chức')

    expect(screen.getByText('Toàn Chức Cao Thủ')).toBeInTheDocument()
    expect(screen.queryByText('Vũ Động Càn Khôn')).not.toBeInTheDocument()
  })
})
