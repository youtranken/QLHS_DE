import { useEffect, useRef, type KeyboardEvent } from 'react'

// `:not([disabled])` keeps a disabled button from swallowing the Tab cycle; the
// offsetParent filter (below) drops anything hidden (collapsed fieldset, display:none).
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Focus-trap for modal dialogs (UX-DR15), extracted from the five hand-rolled
 * copies (ConfirmModal, 3 board modals, StationDrawer): on mount it focuses the
 * first real field (input/select/textarea, else the first focusable control),
 * cycles Tab within the dialog, calls `onEscape` on Esc, and restores focus to
 * the opener on unmount. Attach `ref` to the dialog and `onKeyDown` to it.
 */
export function useFocusTrap<T extends HTMLElement>(onEscape: () => void) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    // Prefer a data field over the ✕ close button so keyboard users land where
    // they type, not on "cancel" (H: Handover used to autofocus ✕).
    const first =
      ref.current?.querySelector<HTMLElement>('input, select, textarea') ??
      ref.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    return () => opener?.focus()
  }, [])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onEscape()
      return
    }
    if (e.key !== 'Tab') return
    const nodes = ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (!nodes || nodes.length === 0) return
    // offsetParent is null for hidden controls AND for position:fixed ones — if
    // filtering leaves nothing, fall back to the raw list so Tab still cycles.
    const visible = Array.from(nodes).filter((el) => el.offsetParent !== null)
    const list = visible.length > 0 ? visible : Array.from(nodes)
    const firstEl = list[0]
    const lastEl = list[list.length - 1]
    if (!firstEl || !lastEl) return
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault()
      lastEl.focus()
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault()
      firstEl.focus()
    }
  }

  return { ref, onKeyDown }
}
