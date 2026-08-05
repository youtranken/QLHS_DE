import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react'
import type { Placement } from '@floating-ui/react'

/**
 * Anchor a portalled menu to its trigger (ported from QLTS). Floating UI handles
 * flip/shift/collision + real-size measurement + autoUpdate on scroll/resize.
 * The consumer portals to document.body; z-index comes from CSS.
 */
export function useAnchoredMenu(
  open: boolean,
  opts?: { matchWidth?: boolean; maxHeight?: number; placement?: Placement },
) {
  const { matchWidth = false, maxHeight = 320, placement = 'bottom-start' } = opts ?? {}
  const { refs, floatingStyles } = useFloating({
    open,
    placement,
    strategy: 'fixed',
    // Position via top/left, NOT transform — the menu's open animation uses
    // `transform`, which would otherwise override Floating UI's translate and
    // pin the popup to the top-left corner.
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ rects, elements, availableHeight }) {
          elements.floating.style.maxHeight = `${Math.min(availableHeight, maxHeight)}px`
          if (matchWidth) elements.floating.style.width = `${rects.reference.width}px`
        },
      }),
    ],
  })
  return { refs, floatingStyles }
}
