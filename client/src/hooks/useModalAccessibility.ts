import { useEffect, useRef, type RefObject } from 'react'

interface ModalAccessibilityOptions {
  open: boolean
  onClose: () => void
  containerRef: RefObject<HTMLElement | null>
  initialFocusRef?: RefObject<HTMLElement | null>
}

const modalStack: symbol[] = []
const inertElements = new Map<HTMLElement, { count: number; previous: boolean }>()
let previousOverflow = ''

/** Shares focus, Escape, scroll locking and background isolation across modal surfaces. */
export function useModalAccessibility({ open, onClose, containerRef, initialFocusRef }: ModalAccessibilityOptions) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    const container = containerRef.current
    if (!open || !container) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const token = Symbol('modal')
    if (modalStack.length === 0) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    modalStack.push(token)

    const background: HTMLElement[] = []
    let branch: HTMLElement = container
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (!(sibling instanceof HTMLElement) || sibling === branch || sibling.hasAttribute('data-modal-backdrop') || ['SCRIPT', 'STYLE'].includes(sibling.tagName)) continue
        const state = inertElements.get(sibling) ?? { count: 0, previous: sibling.inert }
        state.count += 1
        inertElements.set(sibling, state)
        sibling.toggleAttribute('inert', true)
        background.push(sibling)
      }
      branch = branch.parentElement
      if (branch === document.body) break
    }

    const focusable = () => Array.from(container.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    )).filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[hidden], [inert]') && getComputedStyle(element).visibility !== 'hidden' && element.getClientRects().length > 0)
      .sort((first, second) => {
        const position = first.compareDocumentPosition(second)
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0
      })

    const hadTabIndex = container.hasAttribute('tabindex')
    if (!hadTabIndex) container.tabIndex = -1
    const initialFocus = initialFocusRef?.current
    const canFocusInitial = initialFocus && container.contains(initialFocus) && !initialFocus.matches(':disabled') && !initialFocus.closest('[hidden], [inert]') && getComputedStyle(initialFocus).visibility !== 'hidden' && initialFocus.getClientRects().length > 0
    ;(canFocusInitial ? initialFocus : focusable()[0] ?? container).focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== token) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        closeRef.current()
      } else if (event.key === 'Tab') {
        const elements = focusable()
        const first = elements[0], last = elements.at(-1)
        if (!first || !last) { event.preventDefault(); container.focus(); return }
        if (!container.contains(document.activeElement)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus()
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) {
          event.preventDefault(); last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus()
        }
      }
    }
    const onFocusIn = (event: FocusEvent) => {
      if (modalStack.at(-1) === token && !container.contains(event.target as Node)) {
        ;(focusable()[0] ?? container).focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocusIn)
      const wasTop = modalStack.at(-1) === token
      const index = modalStack.indexOf(token)
      if (index >= 0) modalStack.splice(index, 1)
      for (const element of background) {
        const state = inertElements.get(element)
        if (!state) continue
        if (--state.count === 0) { element.toggleAttribute('inert', state.previous); inertElements.delete(element) }
      }
      if (modalStack.length === 0) document.body.style.overflow = previousOverflow
      if (!hadTabIndex) container.removeAttribute('tabindex')
      if (wasTop && previouslyFocused?.isConnected && !previouslyFocused.closest('[inert]')) previouslyFocused.focus({ preventScroll: true })
    }
  }, [open, containerRef, initialFocusRef])
}
