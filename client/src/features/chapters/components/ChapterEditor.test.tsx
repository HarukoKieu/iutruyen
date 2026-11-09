import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ChapterEditor from './ChapterEditor'
describe('ChapterEditor', () => {
  it('renders formatting and replaces asynchronously loaded content', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<ChapterEditor value="<p>Chương một</p>" onChange={onChange} />)
    expect(await screen.findByRole('textbox', { name: 'Nội dung chương' })).toHaveTextContent('Chương một')
    expect(await screen.findByText('2 từ')).toBeInTheDocument()
    rerender(<ChapterEditor value="<p>Chương hai</p>" onChange={onChange} />)
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveTextContent('Chương hai'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Đậm' })).toBeInTheDocument()
  })
  it('preview is read-only and drops unsafe HTML attributes', async () => {
    render(<ChapterEditor value={'<p onclick="alert(1)">Nội dung</p><script>evil()</script>'} readOnly />)
    const editor = await screen.findByRole('textbox')
    expect(editor).toHaveAttribute('contenteditable', 'false')
    expect(editor.innerHTML).not.toContain('onclick')
    expect(editor.querySelector('script')).toBeNull()
    expect(screen.queryByRole('toolbar')).toBeNull()
  })
})
