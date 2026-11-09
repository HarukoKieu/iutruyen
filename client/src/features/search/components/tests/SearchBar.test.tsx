import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SearchBar } from '../SearchBar'

vi.mock('../../hooks/useSearch', () => ({
  useSearchSuggestions: () => ({ data: {
    history: ['Lịch sử đọc'], suggestions: ['Tiên hiệp'],
    stories: [{ _id: 'story', title: 'Tiên Nghịch', slug: 'tien-nghich', ratingAverage: 0 }],
    trending: ['Huyền huyễn'],
  } }),
  useDeleteSearchHistory: () => ({ mutate: vi.fn() }),
}))

function CurrentLocation() {
  const location = useLocation()
  return <output aria-label="Địa chỉ hiện tại">{location.pathname}{location.search}</output>
}

function renderSearch() {
  render(<MemoryRouter><SearchBar /><CurrentLocation /></MemoryRouter>)
  const input = screen.getByRole('combobox', { name: 'Tìm kiếm truyện' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'Tiên' } })
  return input
}

describe('search suggestions keyboard selection', () => {
  it('submits the selected history entry instead of the typed query', () => {
    const input = renderSearch()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const option = screen.getByRole('option', { name: /Lịch sử đọc/ })
    expect(input).toHaveAttribute('aria-activedescendant', option.id)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByLabelText('Địa chỉ hiện tại')).toHaveTextContent(`/search?q=${encodeURIComponent('Lịch sử đọc')}`)
  })

  it('opens the selected story when Enter is pressed', () => {
    const input = renderSearch()
    for (let index = 0; index < 3; index += 1) fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByLabelText('Địa chỉ hiện tại')).toHaveTextContent('/stories/tien-nghich')
  })

  it('submits typed text with no selection and dismisses suggestions with Escape', () => {
    const input = renderSearch()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByLabelText('Địa chỉ hiện tại')).toHaveTextContent(`/search?q=${encodeURIComponent('Tiên')}`)
  })
})
