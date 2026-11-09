import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StoryCard } from '../StoryCard'
import { createMockStory } from '@/test/mockData'

describe('StoryCard Component', () => {
  const fakeStory = createMockStory({
    _id: 'story-1',
    title: 'Đại Quản Gia Là Ma Hoàng',
    slug: 'dai-quan-gia-la-ma-hoang',
    description: 'Truyện trọng sinh tu ma đỉnh cao...',
    authorId: {
      _id: 'author-1',
      username: 'daocuc',
      displayName: 'Đạo Cực',
      role: 'author',
    },
    genreIds: [
      { _id: 'g-1', name: 'Tiên Hiệp', slug: 'tien-hiep', createdAt: '', updatedAt: '' },
      { _id: 'g-2', name: 'Huyền Huyễn', slug: 'huyen-huan', createdAt: '', updatedAt: '' },
    ],
    status: 'completed',
    chapterCount: 1300,
    viewCount: 2500000,
    ratingAverage: 4.8,
    ratingCount: 520,
    contentWarning: 'mature18+',
  })

  it('should render story title, author name, chapter count and badges correctly', () => {
    render(
      <MemoryRouter>
        <StoryCard story={fakeStory} />
      </MemoryRouter>
    )

    // Check title heading
    expect(screen.getByRole('heading', { level: 3, name: 'Đại Quản Gia Là Ma Hoàng' })).toBeInTheDocument()

    // Check author
    expect(screen.getByText('Đạo Cực')).toBeInTheDocument()

    // Check status badge
    expect(screen.getByText('Full')).toBeInTheDocument()

    // Check 18+ badge
    expect(screen.getByText('18+')).toBeInTheDocument()

    // Check genres
    expect(screen.getByText('Tiên Hiệp')).toBeInTheDocument()
    expect(screen.getByText('Huyền Huyễn')).toBeInTheDocument()

    // Check link href
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/stories/dai-quan-gia-la-ma-hoang')
  })
})
