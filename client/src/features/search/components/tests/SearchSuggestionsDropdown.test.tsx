import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SearchSuggestionsDropdown } from '../SearchSuggestionsDropdown'

describe('SearchSuggestionsDropdown', () => {
  const mockSuggestionsData = {
    history: ['tiên hiệp đô thị', 'võng du'],
    suggestions: ['tiên hiệp tu chân', 'tiên hiệp hỗn nguyên'],
    stories: [
      {
        _id: 's1',
        title: 'Tiên Nghịch',
        slug: 'tien-nghich',
        coverUrl: 'http://example.com/cover.jpg',
        ratingAverage: 4.8,
        viewCount: 15000,
        status: 'completed',
        author: { displayName: 'Nhĩ Căn', username: 'nhican' },
        genres: [{ name: 'Tiên Hiệp', slug: 'tien-hiep' }],
      },
    ],
    trending: ['Đô Thị', 'Huyền Huyễn'],
  }

  it('renders all sections correctly', () => {
    render(
      <MemoryRouter>
        <SearchSuggestionsDropdown
          query="tiên"
          suggestionsData={mockSuggestionsData}
          selectedIndex={-1}
          onSelectQuery={vi.fn()}
          onDeleteHistoryItem={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('Lịch sử tìm kiếm')).toBeInTheDocument()
    expect(screen.getByText('tiên hiệp đô thị')).toBeInTheDocument()
    expect(screen.getByText('Từ khóa gợi ý')).toBeInTheDocument()
    expect(screen.getByText('Truyện phù hợp')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Tiên Nghịch' })).toBeInTheDocument()
    expect(screen.getByText('Nhĩ Căn')).toBeInTheDocument()
  })

  it('calls onSelectQuery when clicking on a suggestion item', () => {
    const onSelectQuery = vi.fn()
    render(
      <MemoryRouter>
        <SearchSuggestionsDropdown
          query="tiên"
          suggestionsData={mockSuggestionsData}
          selectedIndex={-1}
          onSelectQuery={onSelectQuery}
          onDeleteHistoryItem={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    )

    const historyItem = screen.getByText('tiên hiệp đô thị')
    fireEvent.click(historyItem)
    expect(onSelectQuery).toHaveBeenCalledWith('tiên hiệp đô thị')
  })

  it('calls onDeleteHistoryItem when clicking the delete button on a history item', () => {
    const onDeleteHistoryItem = vi.fn()
    render(
      <MemoryRouter>
        <SearchSuggestionsDropdown
          query="tiên"
          suggestionsData={mockSuggestionsData}
          selectedIndex={-1}
          onSelectQuery={vi.fn()}
          onDeleteHistoryItem={onDeleteHistoryItem}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    )

    const deleteButtons = screen.getAllByTitle('Xóa khỏi lịch sử')
    fireEvent.click(deleteButtons[0])
    expect(onDeleteHistoryItem).toHaveBeenCalledWith('tiên hiệp đô thị')
  })

  it('renders trending when query is empty', () => {
    render(
      <MemoryRouter>
        <SearchSuggestionsDropdown
          query=""
          suggestionsData={{
            history: [],
            suggestions: [],
            stories: [],
            trending: ['Đô Thị', 'Huyền Huyễn'],
          }}
          selectedIndex={-1}
          onSelectQuery={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('Xu hướng tìm kiếm')).toBeInTheDocument()
    expect(screen.getByText('Đô Thị')).toBeInTheDocument()
    expect(screen.getByText('Huyền Huyễn')).toBeInTheDocument()
  })
})
