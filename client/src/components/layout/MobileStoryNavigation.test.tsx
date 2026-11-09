import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { MobileStoryNavigation } from './MobileStoryNavigation'

const state = vi.hoisted(() => ({ refetch: vi.fn(), isLoading: false, isError: false }))
vi.mock('@/features/stories/hooks/useGenres', () => ({ useGenres: () => ({
  data: [{ _id: 'romance', name: 'Ngôn Tình' }, { _id: 'fantasy', name: 'Huyền Huyễn' }],
  ...state,
}) }))

function Location() {
  const location = useLocation()
  return <output aria-label="Trang hiện tại">{location.pathname}{location.search}</output>
}
function renderNavigation(path = '/') {
  render(<MemoryRouter initialEntries={[path]}><MobileStoryNavigation /><Location /></MemoryRouter>)
}
beforeEach(() => {
  state.isLoading = false
  state.isError = false
  state.refetch.mockReset()
})

describe('mobile story discovery navigation', () => {
  it.each([
    ['/stories?sort=hot', 'Truyện hot'],
    ['/ranking', 'Bảng xếp hạng'],
    ['/stories?status=completed', 'Truyện full'],
  ])('links to %s and marks the selected destination', (path, label) => {
    renderNavigation(path)
    const link = screen.getByRole('link', { name: label })
    expect(link).toHaveAttribute('href', path)
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link').filter(item => item.getAttribute('aria-current') === 'page')).toHaveLength(1)
  })

  it('opens the genre selector and navigates to the chosen genre', () => {
    renderNavigation()
    const trigger = screen.getByRole('button', { name: 'Thể loại' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Chọn thể loại' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Ngôn Tình' }))
    expect(screen.getByLabelText('Trang hiện tại')).toHaveTextContent('/stories?genre=romance')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the genre selector with Escape and outside clicks', () => {
    renderNavigation()
    const trigger = screen.getByRole('button', { name: 'Thể loại' })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
