import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ContinueReadingRibbon } from '../ContinueReadingRibbon'

describe('ContinueReadingRibbon Component', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should render nothing if no reading history exists in localStorage', () => {
    const { container } = render(
      <MemoryRouter>
        <ContinueReadingRibbon />
      </MemoryRouter>
    )

    expect(container.firstChild).toBeNull()
  })

  it('should render reading progress ribbon when localStorage has novel_last_read', () => {
    const historyItem = {
      storyId: 'story-123',
      storySlug: 'dau-pha-thuong-khung',
      storyTitle: 'Đấu Phá Thương Khung',
      chapterId: 'chap-10',
      chapterNumber: 50,
      chapterTitle: 'Dị Hỏa Xuất Thế',
      totalChapters: 100,
      lastReadAt: new Date().toISOString(),
    }
    localStorage.setItem('novel_last_read', JSON.stringify(historyItem))

    render(
      <MemoryRouter>
        <ContinueReadingRibbon />
      </MemoryRouter>
    )

    expect(screen.getByText('Đang đọc dở')).toBeInTheDocument()
    expect(screen.getByText('Đấu Phá Thương Khung')).toBeInTheDocument()
    expect(screen.getByText('Chương 50: Dị Hỏa Xuất Thế')).toBeInTheDocument()
    expect(screen.getByText(/Tiến độ: 50%/)).toBeInTheDocument()
    expect(screen.getByText('Đọc Tiếp')).toBeInTheDocument()
  })
})
