import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewCard } from '../ReviewCard'
import { createMockReview } from '@/test/mockData'
import { useAuthStore } from '@/features/auth/store/authStore'

describe('ReviewCard Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    })
  })

  it('should render review content, author name, and helpful like count', () => {
    const fakeReview = createMockReview({
      likeCount: 15,
    })

    render(
      <ReviewCard
        review={fakeReview}
        onLike={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('Độc Giả Thâm Niên')).toBeInTheDocument()
    expect(screen.getByText(/Sau khi đọc 100 chương đầu/i)).toBeInTheDocument()
    expect(screen.getByText('15 Hữu ích')).toBeInTheDocument()
  })

  it('should trigger onLike when clicking helpful button while authenticated', async () => {
    const user = userEvent.setup()
    const mockLike = vi.fn().mockResolvedValue(undefined)

    useAuthStore.setState({
      user: { id: 'u-3', email: 'u3@test.com', username: 'u3', displayName: 'U3', role: 'user', isEmailVerified: true },
      accessToken: 'token',
      isAuthenticated: true,
    })

    const fakeReview = createMockReview()

    render(
      <ReviewCard
        review={fakeReview}
        onLike={mockLike}
        onDelete={vi.fn()}
      />
    )

    const likeBtn = screen.getByTitle('Cảm nhận hữu ích')
    await user.click(likeBtn)

    expect(mockLike).toHaveBeenCalledWith(fakeReview._id)
  })
})
