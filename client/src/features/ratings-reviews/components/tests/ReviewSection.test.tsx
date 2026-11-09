import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ReviewSection } from '../ReviewSection'
const mock = vi.hoisted(() => ({ authenticated: false, upsert: vi.fn() }))
vi.mock('@/features/auth/store/authStore', () => ({ useAuthStore: () => ({ user: mock.authenticated ? { id: 'reader' } : null, isAuthenticated: mock.authenticated }) }))
vi.mock('../../hooks/useRatingsReviews', () => ({
  useReviews: () => ({ data: { pages: [{ items: [] }] }, isLoading: false }),
  useMyReview: () => ({ data: { review: null }, isLoading: false }),
  useReviewMutations: () => ({ upsertReview: mock.upsert }),
}))
beforeEach(() => { mock.authenticated = false; mock.upsert.mockReset().mockResolvedValue({}) })
describe('text reviews are accessible from the story discussion', () => {
  it('offers login to guests and shows the empty state', () => {
    render(<MemoryRouter><ReviewSection storyId="story" storyTitle="Truyện" /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Đăng nhập để viết cảm nhận' })).toHaveAttribute('href', '/login')
    expect(screen.getByText('Chưa có cảm nhận về truyện này.')).toBeInTheDocument()
  })
  it('validates and submits a review through the mounted editor', async () => {
    mock.authenticated = true
    const user = userEvent.setup()
    render(<MemoryRouter><ReviewSection storyId="story" storyTitle="Truyện" /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Viết cảm nhận' }))
    expect(screen.getByRole('button', { name: 'Đăng cảm nhận' })).toBeDisabled()
    const content = 'Cảm nhận về nhân vật và cốt truyện với diễn biến rất hấp dẫn.'
    await user.type(screen.getByRole('textbox'), content)
    await user.click(screen.getByRole('button', { name: 'Đăng cảm nhận' }))
    expect(mock.upsert).toHaveBeenCalledWith(content)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
