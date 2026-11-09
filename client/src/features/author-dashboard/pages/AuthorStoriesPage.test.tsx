import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import AuthorStoriesPage from './AuthorStoriesPage'

const state = vi.hoisted(() => ({ isError: true, refetch: vi.fn() }))
vi.mock('@/components/layout/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/features/auth/store/authStore', () => ({ useAuthStore: () => ({ user: { displayName: 'Tác giả' } }) }))
vi.mock('@/features/stories/hooks/useAuthorStories', () => ({ useAuthorStories: () => ({
  data: state.isError ? undefined : { pages: [{ stories: [] }] },
  isLoading: false, isError: state.isError, isFetching: false, refetch: state.refetch,
  error: { isAxiosError: true, response: undefined }, hasNextPage: false,
}) }))
vi.mock('@/features/stories/hooks/useStoryMutations', () => ({ useDeleteStory: () => ({ mutate: vi.fn() }) }))
vi.mock('@/features/stories/components/ChangeCoverModal', () => ({ ChangeCoverModal: () => null }))
vi.mock('@/components/ui/alert-dialog', () => ({ AlertDialog: () => null }))
beforeEach(() => { state.isError = true; state.refetch.mockClear() })
it('does not report missing stories when the server cannot be reached and offers retry', () => {
  render(<MemoryRouter><AuthorStoriesPage /></MemoryRouter>)
  expect(screen.getByRole('alert')).toHaveTextContent('Không kết nối được máy chủ')
  expect(screen.queryByText('Chưa có truyện nào')).not.toBeInTheDocument()
  expect(screen.queryByText(/bạn đang có/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(state.refetch).toHaveBeenCalledTimes(1)
})
it('shows an empty library only after a successful empty response', () => {
  state.isError = false
  render(<MemoryRouter><AuthorStoriesPage /></MemoryRouter>)
  expect(screen.getByText('Chưa có truyện nào')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
