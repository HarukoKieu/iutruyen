import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SearchPage } from '../SearchPage'
import * as useSearchModule from '../../hooks/useSearch'
import * as useGenresModule from '@/features/stories/hooks/useGenres'
import * as authStoreModule from '@/features/auth/store/authStore'
import { createMockStory } from '@/test/mockData'

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(useGenresModule, 'useGenres').mockReturnValue({
      data: [
        { _id: 'g1', name: 'Tiên Hiệp', slug: 'tien-hiep', description: 'Tu tiên' },
        { _id: 'g2', name: 'Huyền Huyễn', slug: 'huyen-huyen', description: 'Kỳ bí' },
      ],
      isLoading: false,
    } as any)

    vi.spyOn(authStoreModule, 'useAuthStore').mockReturnValue({
      isAuthenticated: true,
      user: { _id: 'u1', displayName: 'Test User' },
    } as any)

    vi.spyOn(useSearchModule, 'useSearchHistory').mockReturnValue({
      data: [
        { _id: 'h1', query: 'Tu chân kiếm phái', updatedAt: '2026-09-20' },
      ],
      isLoading: false,
    } as any)

    vi.spyOn(useSearchModule, 'useDeleteSearchHistory').mockReturnValue({
      mutate: vi.fn(),
    } as any)

    vi.spyOn(useSearchModule, 'useSearchSuggestions').mockReturnValue({
      data: {
        history: [],
        suggestions: [],
        stories: [],
        trending: ['Tiên Hiệp', 'Huyền Huyễn'],
      },
      isLoading: false,
    } as any)
  })

  it('renders default state with search input, trending tags and genres when no query is present', () => {
    vi.spyOn(useSearchModule, 'useSearchStories').mockReturnValue({
      data: { pages: [{ stories: [], meta: { limit: 20, nextCursor: null, hasMore: false } }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isError: false,
    } as any)

    render(
      <MemoryRouter initialEntries={['/search']}>
        <SearchPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Tìm kiếm truyện' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Tìm truyện, tác giả, thể loại...')).toBeInTheDocument()
    expect(screen.getByText('Xu hướng tìm kiếm nổi bật')).toBeInTheDocument()
    expect(screen.getByText('Khám phá theo thể loại')).toBeInTheDocument()
    expect(screen.getByText('Tu chân kiếm phái')).toBeInTheDocument()
  })

  it('renders search results and filter sidebar when query is present in URL', () => {
    const mockStories = [
      createMockStory({
        _id: 's1',
        title: 'Vạn Cổ Chí Tôn',
        slug: 'van-co-chi-ton',
        ratingAverage: 4.8,
        viewCount: 25000,
      }),
    ]

    vi.spyOn(useSearchModule, 'useSearchStories').mockReturnValue({
      data: {
        pages: [{ stories: mockStories, meta: { limit: 20, nextCursor: null, hasMore: false } }],
      },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isError: false,
    } as any)

    render(
      <MemoryRouter initialEntries={['/search?q=Vạn+Cổ']}>
        <SearchPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 3, name: 'Vạn Cổ Chí Tôn' })).toBeInTheDocument()
    expect(screen.getAllByText('Bộ lọc tìm kiếm').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Sắp xếp theo')).toBeInTheDocument()
  })

  it('renders empty state when no stories match query', () => {
    vi.spyOn(useSearchModule, 'useSearchStories').mockReturnValue({
      data: {
        pages: [{ stories: [], meta: { limit: 20, nextCursor: null, hasMore: false } }],
      },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isError: false,
    } as any)

    render(
      <MemoryRouter initialEntries={['/search?q=nonexistentstory']}>
        <SearchPage />
      </MemoryRouter>
    )

    expect(
      screen.getByText(/Không tìm thấy kết quả nào cho/i)
    ).toBeInTheDocument()
    expect(screen.getByText('Xóa bộ lọc')).toBeInTheDocument()
    expect(screen.getByText('Xem tất cả truyện')).toBeInTheDocument()
  })
})
