import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ModerationLayout from './ModerationLayout'

vi.mock('../hooks/useModeration', () => ({ useModerationSummary: () => ({ data: undefined }) }))

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList)
})
afterEach(() => vi.restoreAllMocks())

function mount() {
  render(<MemoryRouter initialEntries={['/mod/stories']}><Routes>
    <Route element={<ModerationLayout />}>
      <Route path="/mod/stories" element={<button type="button">Nội dung trang</button>} />
    </Route>
  </Routes></MemoryRouter>)
}

it('keeps the drawer backdrop interactive while isolating page content and restores focus on dismissal', () => {
  mount()
  const trigger = screen.getByRole('button', { name: '☰ Menu kiểm duyệt' })
  trigger.focus()
  fireEvent.click(trigger)
  const backdrop = document.querySelector('.mod-sidebar-overlay') as HTMLButtonElement
  expect(backdrop.closest('[inert]')).toBeNull()
  expect(backdrop.tabIndex).toBe(-1)
  expect(screen.getByRole('main')).toHaveAttribute('inert')
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent.click(backdrop)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('main')).not.toHaveAttribute('inert')
  expect(trigger).toHaveFocus()
})

it('wraps focus in DOM order and restores the trigger after Escape', () => {
  mount()
  const trigger = screen.getByRole('button', { name: '☰ Menu kiểm duyệt' })
  trigger.focus()
  fireEvent.click(trigger)
  const close = document.querySelector('.mod-sidebar-close') as HTMLButtonElement
  const last = screen.getByRole('link', { name: '← Về trang chủ' })
  expect(close).toHaveFocus()
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
  expect(last).toHaveFocus()
  fireEvent.keyDown(last, { key: 'Tab' })
  expect(close).toHaveFocus()
  fireEvent.keyDown(close, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})
