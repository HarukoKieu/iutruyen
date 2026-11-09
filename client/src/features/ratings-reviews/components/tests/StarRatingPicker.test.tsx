import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StarRatingPicker } from '../StarRatingPicker'

describe('StarRatingPicker Component', () => {
  it('should render 5 rating buttons', () => {
    render(<StarRatingPicker rating={0} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
  })

  it('should call onChange with chosen score when clicked', async () => {
    const user = userEvent.setup()
    const mockChange = vi.fn()

    render(<StarRatingPicker rating={0} onChange={mockChange} />)

    const star5 = screen.getByTitle('Tuyệt tác siêu phẩm')
    await user.click(star5)

    expect(mockChange).toHaveBeenCalledWith(5)
  })

  it('should display active rating label', () => {
    render(<StarRatingPicker rating={4} onChange={vi.fn()} />)
    expect(screen.getByText('4★ - Hay, đáng đọc')).toBeInTheDocument()
  })

  it('should disable buttons when readOnly is true', () => {
    render(<StarRatingPicker rating={5} readOnly />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })
})
