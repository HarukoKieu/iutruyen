import { StrictMode, useRef, useState } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useModalAccessibility } from '@/hooks/useModalAccessibility'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog'
import { AlertDialog } from './alert-dialog'
import { Input } from './input'
import { PasswordInput } from './password-input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

const inertDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'inert')

beforeAll(() => {
  // jsdom has no layout engine; model visible boxes and native inert reflection.
  if (!inertDescriptor) Object.defineProperty(HTMLElement.prototype, 'inert', {
    configurable: true,
    get() { return this.hasAttribute('inert') },
    set(value: boolean) { this.toggleAttribute('inert', value) },
  })
})

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return (this.closest('[hidden]') || getComputedStyle(this).display === 'none' ? [] : [new DOMRect(0, 0, 100, 20)]) as unknown as DOMRectList
  })
  document.body.style.overflow = 'auto'
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.body.style.overflow = ''
})

afterAll(() => {
  if (!inertDescriptor) Reflect.deleteProperty(HTMLElement.prototype, 'inert')
})

function DialogExample() {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  return <>
    <button type="button">Ngoài hộp thoại</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger><button type="button">Mở hộp thoại</button></DialogTrigger>
      <DialogContent>
        <DialogTitle>Cài đặt</DialogTitle>
        <DialogDescription>Cập nhật lựa chọn đọc của bạn.</DialogDescription>
        <button type="button" disabled tabIndex={0}>Không khả dụng</button>
        <label>Tên hiển thị<input /></label>
        <button type="button" onClick={() => setConfirming(true)}>Mở xác nhận</button>
        <AlertDialog open={confirming} onOpenChange={setConfirming} title="Xác nhận thay đổi" description="Kiểm tra trước khi lưu." onConfirm={() => {}} />
      </DialogContent>
    </Dialog>
  </>
}

function EmptyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useModalAccessibility({ open, onClose, containerRef })
  return open ? <div ref={containerRef} role="dialog" aria-label="Đang xử lý">Đang xử lý</div> : null
}

describe('modal accessibility', () => {
  it('focuses the content, traps both Tab directions, isolates background and restores focus/scroll', async () => {
    const user = userEvent.setup()
    const view = render(<StrictMode><DialogExample /></StrictMode>)
    const opener = screen.getByRole('button', { name: 'Mở hộp thoại' })
    await user.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Cài đặt' })
    const close = within(dialog).getByRole('button', { name: 'Đóng hộp thoại' })
    const last = within(dialog).getByRole('button', { name: 'Mở xác nhận' })
    expect(dialog).toHaveAccessibleDescription('Cập nhật lựa chọn đọc của bạn.')
    expect(dialog.closest('[inert]')).toBeNull()
    expect(close).toHaveFocus()
    expect(view.container.inert).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    expect(dialog.parentElement?.querySelector('[data-modal-backdrop]')?.closest('[inert]')).toBeNull()

    await user.tab({ shift: true })
    expect(last).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab()
    expect(within(dialog).getByRole('textbox', { name: 'Tên hiển thị' })).toHaveFocus()

    screen.getByText('Ngoài hộp thoại').focus()
    expect(close).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(view.container.inert).toBe(false)
    expect(document.body.style.overflow).toBe('auto')
  })

  it('keeps backdrop dismissal usable while excluding it from accessible content', async () => {
    const user = userEvent.setup()
    render(<DialogExample />)
    await user.click(screen.getByRole('button', { name: 'Mở hộp thoại' }))
    const dialog = screen.getByRole('dialog', { name: 'Cài đặt' })
    const backdrop = dialog.parentElement?.querySelector<HTMLElement>('[data-modal-backdrop]')
    expect(backdrop).toHaveAttribute('aria-hidden', 'true')
    expect(backdrop?.inert).toBe(false)
    if (!backdrop) throw new Error('Missing modal backdrop')
    await user.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes only the top nested modal and restores the parent before the original opener', async () => {
    const user = userEvent.setup()
    const view = render(<DialogExample />)
    const opener = screen.getByRole('button', { name: 'Mở hộp thoại' })
    await user.click(opener)
    const childOpener = screen.getByRole('button', { name: 'Mở xác nhận' })
    await user.click(childOpener)

    const alert = screen.getByRole('alertdialog', { name: 'Xác nhận thay đổi' })
    expect(within(alert).getByRole('button', { name: 'Hủy bỏ' })).toHaveFocus()
    expect(childOpener.closest('[inert]')).not.toBeNull()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Cài đặt' })).toBeInTheDocument()
    expect(childOpener).toHaveFocus()
    expect(view.container.inert).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(view.container.inert).toBe(false)
    expect(document.body.style.overflow).toBe('auto')
  })

  it('focuses the alert container when its preferred initial control is disabled and blocks loading dismissal', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<AlertDialog open onOpenChange={onOpenChange} title="Đang lưu" description="Vui lòng chờ." isLoading onConfirm={vi.fn()} />)
    const dialog = screen.getByRole('alertdialog', { name: 'Đang lưu' })
    expect(dialog).toHaveFocus()
    await user.tab()
    expect(dialog).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(dialog).toHaveAttribute('aria-busy', 'true')
  })

  it('keeps focus in a modal without controls and preserves pre-existing inert background on cleanup', async () => {
    const user = userEvent.setup()
    const background = document.createElement('div')
    background.inert = true
    document.body.append(background)
    const onClose = vi.fn()
    const view = render(<EmptyModal open onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Đang xử lý' })
    expect(dialog).toHaveFocus()
    await user.tab()
    expect(dialog).toHaveFocus()
    await user.tab({ shift: true })
    expect(dialog).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
    view.unmount()
    expect(background.inert).toBe(true)
    expect(document.body.style.overflow).toBe('auto')
    background.remove()
  })
})

describe('tabs and form accessibility', () => {
  it('moves selection with arrows/Home/End, skips disabled tabs and connects the selected panel', async () => {
    const user = userEvent.setup()
    render(<Tabs defaultValue="profile">
      <TabsList aria-label="Tài khoản">
        <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
        <TabsTrigger value="locked" disabled>Đã khóa</TabsTrigger>
        <TabsTrigger value="password">Mật khẩu</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">Thông tin cá nhân</TabsContent>
      <TabsContent value="password">Đổi mật khẩu</TabsContent>
    </Tabs>)
    const profile = screen.getByRole('tab', { name: 'Hồ sơ' })
    const password = screen.getByRole('tab', { name: 'Mật khẩu' })
    await user.tab()
    expect(profile).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(password).toHaveFocus()
    expect(password).toHaveAttribute('aria-selected', 'true')
    expect(profile).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel', { name: 'Mật khẩu' })).toHaveAttribute('id', password.getAttribute('aria-controls'))
    await user.keyboard('{ArrowRight}')
    expect(profile).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(password).toHaveFocus()
    await user.keyboard('{Home}')
    expect(profile).toHaveFocus()
    await user.keyboard('{End}')
    expect(password).toHaveFocus()
  })

  it('honors vertical orientation and a consumer that prevents keyboard selection', async () => {
    const user = userEvent.setup()
    render(<Tabs defaultValue="one"><TabsList aria-orientation="vertical">
      <TabsTrigger value="one" onKeyDown={event => { if (event.key === 'End') event.preventDefault() }}>Một</TabsTrigger>
      <TabsTrigger value="two">Hai</TabsTrigger>
    </TabsList><TabsContent value="one">Một nội dung</TabsContent><TabsContent value="two">Hai nội dung</TabsContent></Tabs>)
    const first = screen.getByRole('tab', { name: 'Một' })
    first.focus()
    await user.keyboard('{End}')
    expect(first).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('tab', { name: 'Hai' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(first).toHaveFocus()
  })

  it('announces field errors with existing help text and clears the association after correction', () => {
    const view = render(<><label htmlFor="email">Email</label><Input id="email" aria-describedby="email-help" error="Email không hợp lệ" /><p id="email-help">Dùng email đã đăng ký.</p></>)
    const input = screen.getByRole('textbox', { name: 'Email' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Dùng email đã đăng ký. Email không hợp lệ')
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'email-error')
    view.rerender(<><label htmlFor="email">Email</label><Input id="email" aria-describedby="email-help" /><p id="email-help">Dùng email đã đăng ký.</p></>)
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).toHaveAccessibleDescription('Dùng email đã đăng ký.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('associates password errors and keeps visibility controls in sync with disabled state', async () => {
    const user = userEvent.setup()
    const view = render(<><label htmlFor="password">Mật khẩu</label><PasswordInput id="password" aria-describedby="password-help" error="Mật khẩu quá ngắn" /><p id="password-help">Ít nhất 6 ký tự.</p></>)
    const password = screen.getByLabelText('Mật khẩu', { exact: true })
    expect(password).toHaveAccessibleDescription('Ít nhất 6 ký tự. Mật khẩu quá ngắn')
    const toggle = screen.getByRole('button', { name: 'Hiện mật khẩu' })
    expect(toggle).toHaveAttribute('aria-controls', 'password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toHaveAttribute('aria-pressed', 'true')
    view.rerender(<><label htmlFor="password">Mật khẩu</label><PasswordInput id="password" disabled /><p id="password-help">Ít nhất 6 ký tự.</p></>)
    expect(password).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toBeDisabled()
    expect(password).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
