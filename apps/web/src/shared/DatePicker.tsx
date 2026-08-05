import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredMenu } from './useAnchoredMenu'
import { buildDays, buildYears, decadeStart, parseISO, sameDay, stripTime, toISO } from './datePickerUtils'
import { t } from '../i18n'

const LOCALE = 'vi-VN'

/**
 * DatePicker (ported from QLTS) — drop-in for `<input type=date>`: value/onChange
 * are 'YYYY-MM-DD' ('' = unset). Calendar popover with day/month/year drill,
 * min/max, portalled to <body> so it escapes overflow + transformed ancestors.
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

  useEffect(() => {
    if (open) {
      setCursor(selected ?? new Date())
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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, refs.domReference, refs.floating])

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

  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(LOCALE, { month: 'short' })),
    [],
  )
  const weekdayNames = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(LOCALE, { weekday: 'narrow' })),
    [],
  )

  return (
    <div className={`dp${open ? ' open' : ''}`} ref={refs.setReference}>
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
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <rect x="3" y="4" width="18" height="17" rx="3" />
          <path d="M8 2v4M16 2v4M3 10h18" />
        </svg>
        <span className={selected ? 'dp-val' : 'dp-val ph'}>{label}</span>
        {clearable && selected && (
          <span
            className="dp-clear"
            role="button"
            aria-label={t('common.datePicker.clear')}
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onChange('')
              }
            }}
          >
            ✕
          </span>
        )}
        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div className="dp-pop" role="dialog" style={floatingStyles} ref={refs.setFloating}>
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
                  <div className="dp-grid days">
                    {buildDays(cursor).map((cell, i) => {
                      const isSel = selected && sameDay(cell.date, selected)
                      const isToday = sameDay(cell.date, new Date())
                      return (
                        <button
                          key={i}
                          type="button"
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
