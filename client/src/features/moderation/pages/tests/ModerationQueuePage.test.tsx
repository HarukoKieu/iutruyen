import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ModerationQueuePage from '../ModerationQueuePage'
import * as moderationApi from '../../api/moderation.api'
import { createMockStory, createMockComment } from '@/test/mockData'

vi.mock('../../api/moderation.api')

const mkClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

const renderPage = (initialEntries = ['/mod/stories'], client = mkClient()) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/mod/:type" element={<ModerationQueuePage />} />
          <Route path="/mod" element={<ModerationQueuePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('ModerationQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders queue header and tab navigation', async () => {
    vi.mocked(moderationApi.fetchStoryQueue).mockResolvedValue({
      stories: [],
      meta: { limit: 20, nextCursor: null, hasMore: false },
    })

    renderPage()

    expect(screen.getByText('Hàng Đợi Kiểm Duyệt')).toBeInTheDocument()
    expect(screen.getByText('Truyện')).toBeInTheDocument()
    expect(screen.getByText('Chương')).toBeInTheDocument()
    expect(screen.getByText('Bình luận')).toBeInTheDocument()
    expect(await screen.findByText(/Không có truyện nào chờ duyệt/i)).toBeInTheDocument()
  })

  it('displays pending stories and expands details', async () => {
    const mockStory = createMockStory({
      _id: 'story-mod-1',
      title: 'Tu Chân Giới Siêu Cấp',
      moderationStatus: 'pending',
      description: 'Nội dung cốt truyện chi tiết về một tu sĩ...',
    })

    vi.mocked(moderationApi.fetchStoryQueue).mockResolvedValue({
      stories: [mockStory],
      meta: { limit: 20, nextCursor: null, hasMore: false },
    })

    renderPage(['/mod/stories'])

    expect(await screen.findByText('Tu Chân Giới Siêu Cấp')).toBeInTheDocument()
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()

    // Expand details by clicking title / header
    fireEvent.click(screen.getByText('Tu Chân Giới Siêu Cấp'))
    expect(screen.getByText(/Nội dung cốt truyện chi tiết/i)).toBeInTheDocument()
  })

  it('opens action modal and confirms approval for a story', async () => {
    const mockStory = createMockStory({
      _id: 'story-mod-1',
      title: 'Tu Chân Giới Siêu Cấp',
    })

    vi.mocked(moderationApi.fetchStoryQueue).mockResolvedValue({
      stories: [mockStory],
      meta: { limit: 20, nextCursor: null, hasMore: false },
    })
    vi.mocked(moderationApi.moderateStory).mockResolvedValue(undefined)

    renderPage(['/mod/stories'])

    const approveBtn = await screen.findByRole('button', { name: /✓ Duyệt/i })
    fireEvent.click(approveBtn)

    // Action modal opens
    expect(await screen.findByText(/Duyệt truyện/i)).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: /Xác nhận Duyệt/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(moderationApi.moderateStory).toHaveBeenCalledWith('story-mod-1', 'approve', {
        reason: undefined,
        note: undefined,
        notifyUser: true,
      })
    })
  })

  it('renders comment queue when navigating to comments tab', async () => {
    const mockComment = createMockComment({
      _id: 'cmt-mod-1',
      content: 'Bình luận chứa link lừa đảo http://example.com',
      spamScore: 85,
    })

    vi.mocked(moderationApi.fetchCommentQueue).mockResolvedValue({
      comments: [mockComment as any],
      meta: { limit: 20, nextCursor: null, hasMore: false },
    })

    renderPage(['/mod/comments'])

    expect(await screen.findByText(/Bình luận chứa link lừa đảo/i)).toBeInTheDocument()
    expect(screen.getByText(/Spam 85%/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /✓ Bỏ cờ/i })).toBeInTheDocument()
  })
})
