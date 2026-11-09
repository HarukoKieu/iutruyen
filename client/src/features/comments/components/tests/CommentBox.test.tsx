import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CommentBox } from '../CommentBox'
import { useAuthStore } from '@/features/auth/store/authStore'

describe('CommentBox Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    })
  })

  it('should render login prompt when user is not authenticated', () => {
    render(
      <MemoryRouter>
        <CommentBox onSubmit={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.getByText(/Vui lòng đăng nhập để tham gia bình luận/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Đăng nhập ngay/i })).toHaveAttribute('href', '/login')
  })

  it('should render comment input and character count when authenticated', () => {
    useAuthStore.setState({
      user: {
        id: 'u-1',
        email: 'user@test.com',
        username: 'nguyenvandoc',
        displayName: 'Nguyễn Văn Đọc',
        role: 'user',
        isEmailVerified: true,
      },
      accessToken: 'token-123',
      isAuthenticated: true,
    })

    render(
      <MemoryRouter>
        <CommentBox onSubmit={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.getByPlaceholderText(/Chia sẻ cảm nghĩ của bạn/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gửi bình luận/i })).toBeDisabled()
    expect(screen.getByText('0/1000')).toBeInTheDocument()
  })

  it('should allow typing and submitting content', async () => {
    const user = userEvent.setup()
    const mockSubmit = vi.fn().mockResolvedValue(undefined)

    useAuthStore.setState({
      user: {
        id: 'u-1',
        email: 'user@test.com',
        username: 'nguyenvandoc',
        displayName: 'Nguyễn Văn Đọc',
        role: 'user',
        isEmailVerified: true,
      },
      accessToken: 'token-123',
      isAuthenticated: true,
    })

    render(
      <MemoryRouter>
        <CommentBox onSubmit={mockSubmit} />
      </MemoryRouter>
    )

    const textarea = screen.getByPlaceholderText(/Chia sẻ cảm nghĩ của bạn/i)
    await user.type(textarea, 'Truyện rất hay!')

    expect(screen.getByText('15/1000')).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: /Gửi bình luận/i })
    expect(submitBtn).toBeEnabled()

    await user.click(submitBtn)
    expect(mockSubmit).toHaveBeenCalledWith('Truyện rất hay!')
  })
})
