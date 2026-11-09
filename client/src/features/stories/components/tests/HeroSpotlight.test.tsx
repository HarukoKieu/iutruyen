import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HeroSpotlight } from '../HeroSpotlight'
import { createMockStory } from '@/test/mockData'

describe('HeroSpotlight Component', () => {
  const fakeStories = [
    createMockStory({
      _id: 'spotlight-1',
      title: 'Vạn Cổ Đệ Nhất Thần',
      slug: 'van-co-de-nhat-than',
      description: 'Lý Thiên Mệnh chấp chưởng vạn cổ cự thú...',
      authorId: {
        _id: 'author-8',
        username: 'phongthanhduong',
        displayName: 'Phong Thanh Dương',
        role: 'author',
      },
      genreIds: [{ _id: 'g-10', name: 'Huyền Huyễn', slug: 'huyen-huan', createdAt: '', updatedAt: '' }],
      chapterCount: 4500,
      viewCount: 12000000,
      ratingAverage: 4.95,
      ratingCount: 3000,
    }),
  ]

  it('should render spotlight tag, title, author and CTA buttons', () => {
    render(
      <MemoryRouter>
        <HeroSpotlight stories={fakeStories} />
      </MemoryRouter>
    )

    expect(screen.getByText('TÁC PHẨM TÂM ĐIỂM')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Vạn Cổ Đệ Nhất Thần' })).toBeInTheDocument()
    expect(screen.getByText('Phong Thanh Dương')).toBeInTheDocument()
    expect(screen.getByText('#Huyền Huyễn')).toBeInTheDocument()
    expect(screen.getByText('Đọc Ngay Tác Phẩm')).toBeInTheDocument()
    expect(screen.getByText('Chi Tiết & Mục Lục')).toBeInTheDocument()
  })
})
