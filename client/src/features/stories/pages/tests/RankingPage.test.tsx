import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RankingPage } from '../RankingPage'
import { createMockStory } from '@/test/mockData'
import * as useRankingModule from '../../hooks/useRanking'
import * as useGenresModule from '../../hooks/useGenres'

// Mock AppLayout to simplify testing
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}))

describe('RankingPage', () => {
  const fakeStories = [
    createMockStory({
      _id: 'story-1',
      title: 'Đấu La Đại Lục',
      slug: 'dau-la-dai-luc',
      authorId: { id: 'author-1', username: 'author1', displayName: 'Đường Gia Tam Thiếu', role: 'author' } as any,
      chapterCount: 300,
      viewCount: 2500000,
      followCount: 50000,
      ratingAverage: 4.9,
      ratingCount: 1200,
      description: 'Hồn sư thế giới đầy kỳ bí...',
    }),
    createMockStory({
      _id: 'story-2',
      title: 'Phàm Nhân Tu Tiên',
      slug: 'pham-nhan-tu-tien',
      authorId: { id: 'author-2', username: 'author2', displayName: 'Vong Ngữ', role: 'author' } as any,
      chapterCount: 2400,
      viewCount: 1800000,
      followCount: 40000,
      ratingAverage: 4.8,
      ratingCount: 950,
      description: 'Con đường tu tiên gian nan trắc trở...',
    }),
    createMockStory({
      _id: 'story-3',
      title: 'Tiên Nghịch',
      slug: 'tien-nghich',
      authorId: { id: 'author-3', username: 'author3', displayName: 'Nhĩ Căn', role: 'author' } as any,
      chapterCount: 1900,
      viewCount: 1200000,
      followCount: 35000,
      ratingAverage: 4.7,
      ratingCount: 800,
      description: 'Thuận vi phàm, nghịch tắc tiên...',
    }),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(useGenresModule, 'useGenres').mockReturnValue({
      data: [
        { _id: 'g-1', name: 'Tiên Hiệp', slug: 'tien-hiep', description: 'Tu tiên' },
        { _id: 'g-2', name: 'Huyền Huyễn', slug: 'huyen-huyen', description: 'Huyền huyễn' },
      ],
      isLoading: false,
    } as any)

    vi.spyOn(useRankingModule, 'useRanking').mockReturnValue({
      data: {
        pages: [
          {
            stories: fakeStories,
            meta: { limit: 20, nextCursor: null, hasMore: false },
          },
        ],
        pageParams: [undefined],
      },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    } as any)
  })

  it('renders ranking page title and podium top 3 stories', () => {
    render(
      <MemoryRouter>
        <RankingPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Bảng Xếp Hạng Truyện')).toBeInTheDocument()
    expect(screen.getByText('Top 3 Tác Phẩm Dẫn Đầu')).toBeInTheDocument()

    // Champion #1
    expect(screen.getByText('QUÁN QUÂN #1')).toBeInTheDocument()
    expect(screen.getByText('Đấu La Đại Lục')).toBeInTheDocument()

    // Rank #2 & #3
    expect(screen.getByText('#2 BẠC')).toBeInTheDocument()
    expect(screen.getByText('Phàm Nhân Tu Tiên')).toBeInTheDocument()
    expect(screen.getByText('#3 ĐỒNG')).toBeInTheDocument()
    expect(screen.getByText('Tiên Nghịch')).toBeInTheDocument()
  })

  it('allows switching metric tabs (e.g. follows, rating)', () => {
    render(
      <MemoryRouter>
        <RankingPage />
      </MemoryRouter>
    )

    const followsTab = screen.getByText('Được theo dõi nhất')
    fireEvent.click(followsTab)

    expect(useRankingModule.useRanking).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'follows',
      })
    )
  })

  it('allows filtering by genre pills', () => {
    render(
      <MemoryRouter>
        <RankingPage />
      </MemoryRouter>
    )

    const genrePill = screen.getByRole('button', { name: 'Tiên Hiệp' })
    fireEvent.click(genrePill)

    expect(useRankingModule.useRanking).toHaveBeenCalledWith(
      expect.objectContaining({
        genre: 'tien-hiep',
      })
    )
  })

  it('renders empty state when there are no stories', () => {
    vi.spyOn(useRankingModule, 'useRanking').mockReturnValue({
      data: {
        pages: [
          {
            stories: [],
            meta: { limit: 20, nextCursor: null, hasMore: false },
          },
        ],
        pageParams: [undefined],
      },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    } as any)

    render(
      <MemoryRouter>
        <RankingPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Chưa có dữ liệu bảng xếp hạng')).toBeInTheDocument()
  })

  it('renders error state and retries fetching on button click', () => {
    const mockRefetch = vi.fn()
    vi.spyOn(useRankingModule, 'useRanking').mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isError: true,
      refetch: mockRefetch,
    } as any)

    render(
      <MemoryRouter>
        <RankingPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Không thể tải bảng xếp hạng')).toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i })
    fireEvent.click(retryBtn)
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('renders ranking stories beyond top 3 under "Các Tác Phẩm Tiếp Theo"', () => {
    const fourStories = [
      ...fakeStories,
      createMockStory({
        _id: 'story-4',
        title: 'Mục Thần Ký',
        slug: 'muc-than-ky',
        authorId: { id: 'author-4', username: 'author4', displayName: 'Trạch Trư', role: 'author' } as any,
        chapterCount: 1500,
        viewCount: 900000,
        followCount: 25000,
        ratingAverage: 4.6,
        ratingCount: 600,
      }),
    ]

    vi.spyOn(useRankingModule, 'useRanking').mockReturnValue({
      data: {
        pages: [
          {
            stories: fourStories,
            meta: { limit: 20, nextCursor: 'c-4', hasMore: true },
          },
        ],
        pageParams: [undefined],
      },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
    } as any)

    render(
      <MemoryRouter>
        <RankingPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Các Tác Phẩm Tiếp Theo')).toBeInTheDocument()
    expect(screen.getByText('04')).toBeInTheDocument()
    expect(screen.getByText('Mục Thần Ký')).toBeInTheDocument()
  })

  it('triggers fetchNextPage when clicking load more button', () => {
    const mockFetchNextPage = vi.fn()
    vi.spyOn(useRankingModule, 'useRanking').mockReturnValue({
      data: {
        pages: [
          {
            stories: fakeStories,
            meta: { limit: 20, nextCursor: 'c-next', hasMore: true },
          },
        ],
        pageParams: [undefined],
      },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: mockFetchNextPage,
    } as any)

    render(
      <MemoryRouter>
        <RankingPage />
      </MemoryRouter>
    )

    const loadMoreBtn = screen.getByRole('button', { name: /Tải thêm các thứ hạng tiếp theo/i })
    expect(loadMoreBtn).toBeInTheDocument()
    fireEvent.click(loadMoreBtn)
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('gracefully renders when only 1 top story is returned', () => {
    vi.spyOn(useRankingModule, 'useRanking').mockReturnValue({
      data: {
        pages: [
          {
            stories: [fakeStories[0]],
            meta: { limit: 20, nextCursor: null, hasMore: false },
          },
        ],
        pageParams: [undefined],
      },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    } as any)

    render(
      <MemoryRouter>
        <RankingPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Tác Phẩm Dẫn Đầu')).toBeInTheDocument()
    expect(screen.getByText('Đấu La Đại Lục')).toBeInTheDocument()
    expect(screen.queryByText('#2 BẠC')).not.toBeInTheDocument()
  })
})

