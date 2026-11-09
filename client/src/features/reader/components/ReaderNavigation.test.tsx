import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ReaderNavigation } from './ReaderNavigation'

vi.mock('@/features/auth/store/authStore', () => ({ useAuthStore: () => ({ user: { role: 'author' } }) }))
vi.mock('@/features/stories/hooks/useGenres', () => ({ useGenres: () => ({ data: [{ _id: 'romance', name: 'Ngôn Tình' }] }) }))

function Location() {
  const location = useLocation()
  return <output aria-label="Trang hiện tại">{location.pathname}{location.search}</output>
}
function renderNavigation() {
  render(<MemoryRouter><ReaderNavigation /><Location /></MemoryRouter>)
}

describe('reader navigation on compact screens', () => {
  it('opens the navigation menu and closes it after selecting a destination', () => {
    renderNavigation()
    const trigger = screen.getByRole('button', { name: 'Điều hướng' })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('link', { name: 'Truyện full' }))
    expect(screen.getByLabelText('Trang hiện tại')).toHaveTextContent('/stories?status=completed')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('supports selecting a genre from the compact menu', () => {
    renderNavigation()
    const trigger = screen.getByRole('button', { name: 'Điều hướng' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Thể loại' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ngôn Tình' }))
    expect(screen.getByLabelText('Trang hiện tại')).toHaveTextContent('/stories?genre=romance')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Ngôn Tình' })).not.toBeInTheDocument()
  })

  it('dismisses menus with Escape or an outside click and restores keyboard focus', () => {
    renderNavigation()
    const trigger = screen.getByRole('button', { name: 'Điều hướng' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Thể loại' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Ngôn Tình' })).not.toBeInTheDocument()
    fireEvent.click(trigger)
    fireEvent.mouseDown(document.body)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})
