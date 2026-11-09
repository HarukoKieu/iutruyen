import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommentItem } from '../CommentItem'
import { createMockComment } from '@/test/mockData'
import { useAuthStore } from '@/features/auth/store/authStore'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})

const renderWithQuery = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('CommentItem Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    })
  })

  it('should render comment author name, content and like count', () => {
    const fakeComment = createMockComment({
      content: 'Một chương truyện đầy cảm xúc!',
      likeCount: 8,
    })

    renderWithQuery(
      <CommentItem
        comment={fakeComment}
        onLike={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onToggleLock={vi.fn()}
      />
    )

    expect(screen.getByText('Nguyễn Văn Đọc')).toBeInTheDocument()
    expect(screen.getByText('Một chương truyện đầy cảm xúc!')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('should display Author badge if commenter is story author', () => {
    const fakeComment = createMockComment({
      userId: {
        _id: 'author-id-123',
        displayName: 'Đường Gia Tam Thiếu',
        username: 'duonggiatamthieu',
        role: 'author',
      },
    })

    renderWithQuery(
      <CommentItem
        comment={fakeComment}
        storyAuthorId="author-id-123"
        onLike={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onToggleLock={vi.fn()}
      />
    )

    expect(screen.getByText('Đường Gia Tam Thiếu')).toBeInTheDocument()
    expect(screen.getByText('Tác Giả')).toBeInTheDocument()
  })

  it('should trigger onLike when like button is clicked by authenticated user', async () => {
    const user = userEvent.setup()
    const mockLike = vi.fn().mockResolvedValue(undefined)

    useAuthStore.setState({
      user: { id: 'u-2', email: 'u2@test.com', username: 'u2', displayName: 'U2', role: 'user', isEmailVerified: true },
      accessToken: 'token',
      isAuthenticated: true,
    })

    const fakeComment = createMockComment({
      likedByMe: false,
      likeCount: 2,
    })

    renderWithQuery(
      <CommentItem
        comment={fakeComment}
        onLike={mockLike}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onToggleLock={vi.fn()}
      />
    )

    const likeBtn = screen.getByTitle('Thích bình luận')
    await user.click(likeBtn)

    expect(mockLike).toHaveBeenCalledWith(fakeComment._id)
  })

  it('should allow authenticated user to submit a reply', async () => {
    const user = userEvent.setup()
    const mockReply = vi.fn().mockResolvedValue(undefined)

    useAuthStore.setState({
      user: { id: 'u-1', email: 'u1@test.com', username: 'u1', displayName: 'Bạn Đọc 1', role: 'user', isEmailVerified: true },
      accessToken: 'token',
      isAuthenticated: true,
    })

    const fakeComment = createMockComment({
      _id: 'root-comment-1',
      content: 'Chương này kết bất ngờ thật!',
    })

    renderWithQuery(
      <CommentItem
        comment={fakeComment}
        onLike={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onToggleLock={vi.fn()}
        onReply={mockReply}
      />
    )

    const replyBtn = screen.getByRole('button', { name: /Trả lời/i })
    await user.click(replyBtn)

    const replyInput = screen.getByPlaceholderText(/Trả lời @Nguyễn Văn Đọc.../i)
    await user.type(replyInput, 'Chuẩn luôn bạn ơi!')

    const sendBtn = screen.getByRole('button', { name: /Gửi/i })
    await user.click(sendBtn)

    expect(mockReply).toHaveBeenCalledWith('root-comment-1', 'Chuẩn luôn bạn ơi!')
  })

  it('should display preview replies (first 1-2) and view more button when total replies > 2', () => {
    const fakeComment = createMockComment({
      replyCount: 5,
      previewReplies: [
        createMockComment({
          _id: 'reply-1',
          content: 'Phản hồi số 1',
          userId: { _id: 'u-3', displayName: 'Độc giả 3', username: 'docgia3', role: 'user' },
        }),
        createMockComment({
          _id: 'reply-2',
          content: 'Phản hồi số 2',
          userId: { _id: 'u-4', displayName: 'Độc giả 4', username: 'docgia4', role: 'user' },
        }),
      ],
    })

    renderWithQuery(
      <CommentItem
        comment={fakeComment}
        onLike={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onToggleLock={vi.fn()}
        onReply={vi.fn()}
      />
    )

    expect(screen.getByText('Phản hồi số 1')).toBeInTheDocument()
    expect(screen.getByText('Phản hồi số 2')).toBeInTheDocument()
    expect(screen.getByText(/Xem thêm 3 phản hồi khác/i)).toBeInTheDocument()
  })
})
