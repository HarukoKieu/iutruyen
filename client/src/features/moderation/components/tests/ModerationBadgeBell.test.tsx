import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ModerationBadgeBell } from '../ModerationBadgeBell'
import { useAuthStore } from '@/features/auth/store/authStore'
import * as moderationHook from '../../hooks/useModeration'

vi.mock('@/features/auth/store/authStore')
vi.mock('../../hooks/useModeration')

describe('ModerationBadgeBell', () => {
  it('does not render if user is not authenticated or not mod/admin', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'user', displayName: 'Reader' },
    } as any)

    vi.mocked(moderationHook.useModerationSummary).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any)

    const { container } = render(
      <MemoryRouter>
        <ModerationBadgeBell />
      </MemoryRouter>
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders shield trigger with badge count when user is admin/moderator and has pending items', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'admin', displayName: 'Admin Boss' },
    } as any)

    vi.mocked(moderationHook.useModerationSummary).mockReturnValue({
      data: {
        totalPending: 5,
        pendingReports: 2,
        pendingStories: 1,
        pendingChapters: 2,
        spamComments: 0,
      },
      isLoading: false,
    } as any)

    render(
      <MemoryRouter>
        <ModerationBadgeBell />
      </MemoryRouter>
    )

    const trigger = screen.getByRole('button', { name: /Kiểm duyệt/i })
    expect(trigger).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('opens dropdown panel with review categories when clicked', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'moderator', displayName: 'Mod Team' },
    } as any)

    vi.mocked(moderationHook.useModerationSummary).mockReturnValue({
      data: {
        totalPending: 3,
        pendingReports: 3,
        pendingStories: 0,
        pendingChapters: 0,
        spamComments: 0,
      },
      isLoading: false,
    } as any)

    render(
      <MemoryRouter>
        <ModerationBadgeBell />
      </MemoryRouter>
    )

    const trigger = screen.getByRole('button', { name: /Kiểm duyệt/i })
    fireEvent.click(trigger)

    expect(screen.getByText('Hàng đợi kiểm duyệt')).toBeInTheDocument()
    expect(screen.getByText('Báo cáo từ độc giả')).toBeInTheDocument()
    expect(screen.getByText('3 mục đang chờ xử lý')).toBeInTheDocument()
  })
})

