import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Search } from 'lucide-react'
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

/** Trên ngưỡng này danh sách tự mọc ô lọc gõ-để-tìm (danh mục dài như Project/Team,
 *  Payment Term); dưới ngưỡng (Currency…) giữ dropdown thường cho gọn. */
const SEARCH_MIN = 8

/**
 * Themed select (ported from QLTS) — replaces the native `<select>` whose popup
 * can't be styled. Menu portals to <body> so it escapes modal/table overflow and
 * transformed ancestors, and Floating UI flips it up when there's no room below.
 * Long lists (> SEARCH_MIN) grow a filter box; the height is capped so a big
 * catalog scrolls inside instead of spilling past the popup. Keyboard: gõ để lọc,
 * ↑/↓/Enter/Esc. Group headers are skipped in nav and hidden while filtering.
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
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const optId = (i: number) => `${listId}-opt-${i}`

  const selectable = options.filter((o) => !o.header)
  const selected = options.find((o) => o.value === value && !o.header)
  const label = selected ? selected.label : (placeholder ?? '—')
  const showSearch = selectable.length > SEARCH_MIN

  const labelText = (o: SelectOption) => (typeof o.label === 'string' ? o.label : o.value).toLowerCase()
  const q = query.trim().toLowerCase()
  // Đang lọc → danh sách PHẲNG (bỏ header) chỉ gồm mục khớp; rỗng query → giữ nguyên
  // (còn header nhóm). `rendered` là danh sách vừa render vừa điều hướng bàn phím.
  const rendered = useMemo(
    () => (q ? options.filter((o) => !o.header && labelText(o).includes(q)) : options),
    // labelText is pure; options/q are the real inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, options],
  )
  const firstSelectable = (list: SelectOption[]) => list.findIndex((o) => !o.header)

  const { refs, floatingStyles } = useAnchoredMenu(open, { matchWidth: true, maxHeight: 300 })

  // Open → focus the filter (if any) and point `active` at the current value.
  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const idx = options.findIndex((o) => o.value === value && !o.header)
    setActive(idx < 0 ? firstSelectable(options) : idx)
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 0)
    // only when the menu toggles open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Typing a filter → snap the highlight to the first match.
  useEffect(() => {
    if (open) setActive(firstSelectable(rendered))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

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
  // Step to the next/prev SELECTABLE row (skip group headers), within `rendered`.
  const move = (dir: 1 | -1) =>
    setActive((i) => {
      let n = i
      for (let step = 0; step < rendered.length; step++) {
        n += dir
        if (n < 0 || n >= rendered.length) return i
        if (!rendered[n]?.header) return n
      }
      return i
    })

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      move(e.key === 'ArrowDown' ? 1 : -1)
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      const o = rendered[active]
      if (o && !o.header) choose(o.value)
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }

  const noneLabel = q ? t('common.select.noMatch') : t('common.select.noOptions')
  const hasRows = rendered.some((o) => !o.header)

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
        aria-activedescendant={open && active >= 0 && rendered[active] && !rendered[active].header ? optId(active) : undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? 'fsel-val' : 'fsel-val ph'}>{label}</span>
        <svg className="fsel-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div className="fsel-menu" style={floatingStyles} ref={refs.setFloating}>
            {showSearch && (
              <div className="fsel-search">
                <Search size={14} aria-hidden />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('common.select.searchPlaceholder')}
                  aria-label={t('common.select.searchAria')}
                  onKeyDown={onKeyDown}
                />
              </div>
            )}
            <ul className="fsel-list" role="listbox" id={listId} aria-label={ariaLabel}>
              {!hasRows && (
                <li className="fsel-none" aria-disabled="true">
                  {noneLabel}
                </li>
              )}
              {rendered.map((o, i) =>
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
                      <span className="fsel-opt-label">{o.label}</span>
                      {o.value === value && <Check className="fsel-check" size={15} aria-hidden />}
                    </button>
                  </li>
                ),
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  )
}
