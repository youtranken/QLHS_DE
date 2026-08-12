import { useEffect, useRef, type KeyboardEvent } from 'react'

/**
 * Native <details> only closes on a second click of its <summary>. This adds the
 * menu affordances a popup needs: an outside pointerdown closes it, Escape closes it
 * and returns focus to the summary, and opening focuses the first enabled menu item
 * (keyboard users don't have to Tab in). Attach `ref` to the <details> and spread
 * `onKeyDown` onto it. Mirrors the board card's ⋯ menu behavior (BoardCardView).
 */
export function useDetailsMenu<T extends HTMLDetailsElement>(opts: {
  /** Selector for the first focusable item inside the open menu. */
  menuSelector: string
  /** Selector for the summary to refocus on Escape. */
  summarySelector: string
  /** Whether the <details> is currently in the DOM. The <details> can appear AFTER
   *  mount (a card/detail refetches in place when actions arrive), so this must be a
   *  dep — else the toggle listener never attaches to a late-mounted menu. */
  present: boolean
}) {
  const ref = useRef<T>(null)
  const { menuSelector, summarySelector, present } = opts

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onOutside = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.removeAttribute('open')
    }
    const onToggle = () => {
      if (el.open) {
        document.addEventListener('pointerdown', onOutside, true)
        el.querySelector<HTMLElement>(menuSelector)?.focus()
      } else document.removeEventListener('pointerdown', onOutside, true)
    }
    el.addEventListener('toggle', onToggle)
    return () => {
      el.removeEventListener('toggle', onToggle)
      document.removeEventListener('pointerdown', onOutside, true)
    }
  }, [menuSelector, present])

  const onKeyDown = (e: KeyboardEvent<T>) => {
    if (e.key === 'Escape' && ref.current?.open) {
      e.stopPropagation()
      ref.current.removeAttribute('open')
      ref.current.querySelector<HTMLElement>(summarySelector)?.focus()
    }
  }

  return { ref, onKeyDown }
}
