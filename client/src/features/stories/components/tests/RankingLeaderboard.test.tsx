import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RankingLeaderboard } from '../RankingLeaderboard'
import { createMockStory } from '@/test/mockData'

describe('RankingLeaderboard Component', () => {
  const fakeStories = [
    createMockStory({
      _id: 's-1',
      title: 'Top 1 Story',
      slug: 'top-1-story',
      authorId: { _id: 'a-1', username: 'tacgia1', displayName: 'Tác Giả 1', role: 'author' },
      chapterCount: 50,
      viewCount: 1500000,
      ratingAverage: 5.0,
      ratingCount: 100,
    }),
    createMockStory({
      _id: 's-2',
      title: 'Top 2 Story',
      slug: 'top-2-story',
      authorId: { _id: 'a-2', username: 'tacgia2', displayName: 'Tác Giả 2', role: 'author' },
      chapterCount: 40,
      viewCount: 900000,
      ratingAverage: 4.7,
      ratingCount: 80,
    }),
  ]

  it('should render leaderboard title and top ranked stories with badges', () => {
    render(
      <MemoryRouter>
        <RankingLeaderboard stories={fakeStories} />
      </MemoryRouter>
    )

    expect(screen.getByText('Bảng Xếp Hạng')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('Top 1 Story')).toBeInTheDocument()
    expect(screen.getByText('02')).toBeInTheDocument()
    expect(screen.getByText('Top 2 Story')).toBeInTheDocument()
  })

  it('only offers the supported lifetime ranking', () => {
    render(
      <MemoryRouter>
        <RankingLeaderboard stories={fakeStories} />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Tất cả' })).toHaveAttribute('href', '/ranking')
    expect(screen.queryByRole('link', { name: 'Tuần' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tháng' })).not.toBeInTheDocument()
  })
})
