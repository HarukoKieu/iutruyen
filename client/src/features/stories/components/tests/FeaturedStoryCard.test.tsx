import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FeaturedStoryCard } from '../FeaturedStoryCard'
import { createMockStory } from '@/test/mockData'

describe('FeaturedStoryCard Component', () => {
  const fakeStory = createMockStory({
    _id: 'story-2',
    title: 'Toàn Chức Pháp Sư',
    slug: 'toan-chuc-phap-su',
    description: 'Thế giới ma pháp hiện đại...',
    authorId: {
      _id: 'author-2',
      username: 'loaothat',
      displayName: 'Loạn',
      role: 'author',
    },
    genreIds: [{ _id: 'g-3', name: 'Đô Thị', slug: 'do-thi', createdAt: '', updatedAt: '' }],
    status: 'completed',
    chapterCount: 3200,
    viewCount: 8900000,
    ratingAverage: 4.9,
    ratingCount: 1500,
  })

  it('should render curator note and badge', () => {
    render(
      <MemoryRouter>
        <FeaturedStoryCard story={fakeStory} curatorNote="Tác phẩm xuất sắc" />
      </MemoryRouter>
    )

    expect(screen.getByText('BIÊN TẬP VIÊN ĐỀ CỬ')).toBeInTheDocument()
    expect(screen.getByText('Toàn Chức Pháp Sư')).toBeInTheDocument()
    expect(screen.getByText('"Tác phẩm xuất sắc"')).toBeInTheDocument()
    expect(screen.getByText('Đã Hoàn Thành')).toBeInTheDocument()
  })
})
