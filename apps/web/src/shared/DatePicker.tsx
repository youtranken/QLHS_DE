import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredMenu } from './useAnchoredMenu'
import { buildDays, buildYears, decadeStart, parseISO, sameDay, stripTime, toISO } from './datePickerUtils'
import { t } from '../i18n'

const LOCALE = 'vi-VN'
const POP_FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"])'

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/**
 * DatePicker (ported from QLTS) — drop-in for `<input type=date>`: value/onChange
 * are 'YYYY-MM-DD' ('' = unset). Calendar popover with day/month/year drill,
 * min/max, portalled to <body> so it escapes overflow + transformed ancestors.
 *
 * a11y: the popover is portalled OUTSIDE any modal focus-trap, so on open we move
 * focus into the day grid (roving tabindex + arrow-key nav) and trap Tab within
 * the popover; Escape is scoped (stopPropagation) so it closes only the calendar,
 * not the parent modal, and returns focus to the trigger.
 */
export function DatePicker({
  value,
  onChange,
  placeholder,
  id,
  ariaLabel,
  clearable = true,
  min,
  max,
  disabled = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
  ariaLabel?: string
  clearable?: boolean
  min?: string
  max?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'day' | 'month' | 'year'>('day')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { refs, floatingStyles } = useAnchoredMenu(open, { maxHeight: 360 })

  const selected = useMemo(() => parseISO(value), [value])
  const [cursor, setCursor] = useState(() => selected ?? new Date())
  // The day the keyboard cursor sits on (roving focus); tracked separately from
  // `cursor` (the visible month) so arrow-keys can cross month boundaries.
  const [focusDay, setFocusDay] = useState<Date>(() => selected ?? new Date())

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (open) {
      const anchor = selected ?? new Date()
      setCursor(anchor)
      setFocusDay(anchor)
      setView('day')
    }
  }, [open, selected])

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

  // Move DOM focus onto the roving day cell whenever it (or the view) changes, so
  // keyboard users land in the grid on open and follow the cursor as they arrow.
  useEffect(() => {
    if (!open || view !== 'day') return
    const cell = refs.floating.current?.querySelector<HTMLElement>('[data-focus="1"]')
    cell?.focus()
  }, [open, view, focusDay, cursor, refs.floating])

  const label = useMemo(() => {
    if (!selected) return placeholder ?? t('common.datePicker.choose')
    return selected.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })
  }, [selected, placeholder])

  const minD = useMemo(() => parseISO(min ?? ''), [min])
  const maxD = useMemo(() => parseISO(max ?? ''), [max])
  const outOfRange = useCallback(
    (d: Date) => (minD !== null && d < stripTime(minD)) || (maxD !== null && d > stripTime(maxD)),
    [minD, maxD],
  )
  const pick = useCallback(
    (d: Date) => {
      if (outOfRange(d)) return
      onChange(toISO(d))
      setOpen(false)
      triggerRef.current?.focus()
    },
    [onChange, outOfRange],
  )
  const step = (dir: number) =>
    setCursor((c) => {
      const n = new Date(c)
      if (view === 'day') n.setMonth(n.getMonth() + dir)
      else if (view === 'month') n.setFullYear(n.getFullYear() + dir)
      else n.setFullYear(n.getFullYear() + dir * 10)
      return n
    })

  // Arrow-key navigation over the day grid: move the roving day, pulling the
  // visible month along when the cursor crosses into an adjacent month.
  function moveFocus(next: Date) {
    setFocusDay(next)
    if (next.getMonth() !== cursor.getMonth() || next.getFullYear() !== cursor.getFullYear()) setCursor(next)
  }
  function onGridKey(e: KeyboardEvent) {
    const k = e.key
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (k in map) {
      e.preventDefault()
      moveFocus(addDays(focusDay, map[k]!))
    } else if (k === 'PageUp' || k === 'PageDown') {
      e.preventDefault()
      const n = new Date(focusDay)
      n.setMonth(n.getMonth() + (k === 'PageUp' ? -1 : 1))
      moveFocus(n)
    } else if (k === 'Home' || k === 'End') {
      e.preventDefault()
      moveFocus(addDays(focusDay, (k === 'Home' ? 0 : 6) - focusDay.getDay()))
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault()
      pick(focusDay)
    }
  }

  // Keep Tab inside the portalled popover (it lives outside any modal trap).
  function onPopKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab') return
    const nodes = refs.floating.current?.querySelectorAll<HTMLElement>(POP_FOCUSABLE)
    if (!nodes || nodes.length === 0) return
    const list = Array.from(nodes)
    const firstEl = list[0]!
    const lastEl = list[list.length - 1]!
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault()
      lastEl.focus()
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault()
      firstEl.focus()
    }
  }

  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(LOCALE, { month: 'short' })),
    [],
  )
  const weekdayNames = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(LOCALE, { weekday: 'narrow' })),
    [],
  )

  const showClear = clearable && !!selected
  return (
    <div className={`dp${open ? ' open' : ''}${showClear ? ' has-clear' : ''}`} ref={refs.setReference}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="dp-trigger"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation()
            close()
          } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <rect x="3" y="4" width="18" height="17" rx="3" />
          <path d="M8 2v4M16 2v4M3 10h18" />
        </svg>
        <span className={selected ? 'dp-val' : 'dp-val ph'}>{label}</span>
        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {showClear && (
        <button
          type="button"
          className="dp-clear"
          aria-label={t('common.datePicker.clear')}
          onClick={() => onChange('')}
        >
          ✕
        </button>
      )}
      {open &&
        createPortal(
          <div
            className="dp-pop"
            role="dialog"
            aria-label={ariaLabel ?? t('common.datePicker.choose')}
            style={floatingStyles}
            ref={refs.setFloating}
            onKeyDown={onPopKey}
          >
            <div className="dp-head">
              <button type="button" className="dp-nav" onClick={() => step(-1)} aria-label={t('common.datePicker.prev')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <button
                type="button"
                className="dp-title"
                onClick={() => setView((v) => (v === 'day' ? 'month' : v === 'month' ? 'year' : 'year'))}
              >
                {view === 'day'
                  ? `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`
                  : view === 'month'
                    ? `${cursor.getFullYear()}`
                    : `${decadeStart(cursor)}–${decadeStart(cursor) + 9}`}
              </button>
              <button type="button" className="dp-nav" onClick={() => step(1)} aria-label={t('common.datePicker.next')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
            <div className="dp-body">
              {view === 'day' && (
                <>
                  <div className="dp-week">
                    {weekdayNames.map((w, i) => (
                      <span key={i}>{w}</span>
                    ))}
                  </div>
                  <div className="dp-grid days" role="grid" onKeyDown={onGridKey}>
                    {buildDays(cursor).map((cell, i) => {
                      const isSel = selected && sameDay(cell.date, selected)
                      const isToday = sameDay(cell.date, new Date())
                      const isFocus = sameDay(cell.date, focusDay)
                      return (
                        <button
                          key={i}
                          type="button"
                          role="gridcell"
                          aria-selected={isSel ? true : undefined}
                          data-focus={isFocus ? '1' : undefined}
                          tabIndex={isFocus ? 0 : -1}
                          disabled={outOfRange(cell.date)}
                          className={`dp-cell${cell.dim ? ' dim' : ''}${isSel ? ' sel' : ''}${isToday && !isSel ? ' today' : ''}`}
                          onClick={() => pick(cell.date)}
                        >
                          {cell.date.getDate()}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
              {view === 'month' && (
                <div className="dp-grid months">
                  {monthNames.map((mo, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`dp-cell${selected && selected.getFullYear() === cursor.getFullYear() && selected.getMonth() === i ? ' sel' : ''}`}
                      onClick={() => {
                        setCursor((c) => {
                          const n = new Date(c)
                          n.setMonth(i)
                          return n
                        })
                        setView('day')
                      }}
                    >
                      {mo}
                    </button>
                  ))}
                </div>
              )}
              {view === 'year' && (
                <div className="dp-grid years">
                  {buildYears(cursor).map((y) => (
                    <button
                      key={y}
                      type="button"
                      className={`dp-cell${selected && selected.getFullYear() === y ? ' sel' : ''}`}
                      onClick={() => {
                        setCursor((c) => {
                          const n = new Date(c)
                          n.setFullYear(y)
                          return n
                        })
                        setView('month')
                      }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
