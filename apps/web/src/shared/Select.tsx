import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredMenu } from './useAnchoredMenu'
import { t } from '../i18n'

export interface SelectOption {
  value: string
  label: ReactNode
  /** A non-selectable group header (e.g. flow name above its document types). */
  header?: boolean
  /** Indent this option under its group header so the grouping reads at a glance. */
  indent?: boolean
}

/**
 * Themed select (ported from QLTS) — replaces the native `<select>` whose popup
 * can't be styled. Menu portals to <body> so it escapes modal/table overflow and
 * transformed ancestors, and Floating UI flips it up when there's no room below.
 * Keyboard: ↑/↓/Enter/Esc. Group headers are skipped in nav.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const optId = (i: number) => `${listId}-opt-${i}`

  const selectable = options.filter((o) => !o.header)
  const selected = options.find((o) => o.value === value && !o.header)
  const label = selected ? selected.label : (placeholder ?? '—')

  // Taller menu so grouped catalogs (e.g. Document Type: 3 flow headers + their
  // types) show without an internal scroll; Floating UI still caps it to the space
  // available and flips up near the viewport edge.
  const { refs, floatingStyles } = useAnchoredMenu(open, { matchWidth: true, maxHeight: 440 })

  // Open → active = the currently-selected option (index within `options`).
  useEffect(() => {
    if (!open) return
    const idx = options.findIndex((o) => o.value === value && !o.header)
    setActive(idx < 0 ? options.findIndex((o) => !o.header) : idx)
  }, [open, options, value])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (refs.domReference.current?.contains(target) || refs.floating.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, refs.domReference, refs.floating])

  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
    triggerRef.current?.focus()
  }
  // Step to the next/prev SELECTABLE row (skip group headers).
  const move = (dir: 1 | -1) =>
    setActive((i) => {
      let n = i
      for (let step = 0; step < options.length; step++) {
        n += dir
        if (n < 0 || n >= options.length) return i
        if (!options[n]?.header) return n
      }
      return i
    })

  return (
    <div className={`fsel${className ? ` ${className}` : ''}`} ref={refs.setReference}>
      <button
        ref={triggerRef}
        type="button"
        className="fsel-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !options[active]?.header ? optId(active) : undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) return setOpen(true)
            move(e.key === 'ArrowDown' ? 1 : -1)
          } else if (e.key === 'Enter' && open) {
            e.preventDefault()
            const o = options[active]
            if (o && !o.header) choose(o.value)
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
      >
        <span className={selected ? 'fsel-val' : 'fsel-val ph'}>{label}</span>
        <svg className="fsel-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open &&
        createPortal(
          <ul className="fsel-menu" role="listbox" id={listId} aria-label={ariaLabel} style={floatingStyles} ref={refs.setFloating}>
            {selectable.length === 0 && (
              <li className="fsel-none" aria-disabled="true">
                {t('common.select.noOptions')}
              </li>
            )}
            {options.map((o, i) =>
              o.header ? (
                <li key={`h-${i}`} className="fsel-group" role="presentation">
                  {o.label}
                </li>
              ) : (
                <li key={o.value}>
                  <button
                    type="button"
                    id={optId(i)}
                    role="option"
                    aria-selected={o.value === value}
                    className={`fsel-option${i === active ? ' active' : ''}${o.value === value ? ' sel' : ''}${o.indent ? ' indent' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o.value)}
                  >
                    {o.label}
                  </button>
                </li>
              ),
            )}
          </ul>,
          document.body,
        )}
    </div>
  )
}
