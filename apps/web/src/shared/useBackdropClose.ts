import { useRef, type MouseEvent } from 'react'

/**
 * Close a modal only when the press AND the release both land on the backdrop.
 * A `click` fires on the nearest common ancestor of mousedown+mouseup, so a drag
 * that STARTS inside the dialog (selecting text in a field) and ends on the
 * overlay would otherwise register as a backdrop click and close the modal —
 * silently discarding the user's input. Arming on mousedown fixes that.
 */
export function useBackdropClose(onClose: () => void): {
  onMouseDown: (e: MouseEvent) => void
  onClick: (e: MouseEvent) => void
} {
  const armed = useRef(false)
  return {
    onMouseDown: (e) => {
      armed.current = e.target === e.currentTarget
    },
    onClick: (e) => {
      const onBackdrop = armed.current && e.target === e.currentTarget
      armed.current = false
      if (onBackdrop) onClose()
    },
  }
}
