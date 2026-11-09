import { useEffect, type RefObject } from 'react'

/** Native inert/modal behavior plus explicit Tab wrapping; restores focus on close. */
export function useAdminDialog(ref: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(node => node.getClientRects().length > 0)
      const first = controls[0], last = controls.at(-1)
      if (!first || !last) { event.preventDefault(); dialog.focus(); return }
      if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus() }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus() }
    }
    dialog.addEventListener('keydown', trap)
    return () => { dialog.removeEventListener('keydown', trap); dialog.close(); if (previous?.isConnected) previous.focus() }
  }, [ref])
}
