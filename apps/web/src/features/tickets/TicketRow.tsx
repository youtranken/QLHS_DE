import { Fragment, useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import type { TicketDetail, TicketView } from './api'
import { groupAmount } from '../../shared/format'
import { openTicketDetail } from '../../shared/route'
import { ReturnPanel } from './ReturnPanel'
import { RouteRail } from './RouteRail'
import { StatusCell } from './StatusCell'
import { FLOW_CHIP, RETURN_STATES } from './ticketStates'
import { t as msg } from '../../i18n'

interface TicketRowProps {
  t: TicketView
  seq: number
  openId: string | null
  detail: TicketDetail | null
  onToggle: (id: string) => void
  onDetail: (id: string) => void
  onCancel: (id: string) => void
  onClone: (id: string) => void
  onReturnDone: (detailId: string) => Promise<void>
}

const COLS = 12

export function TicketRow({ t, seq, openId, detail, onToggle, onDetail, onCancel, onClone, onReturnDone }: TicketRowProps) {
  const [menu, setMenu] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const dotsRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const cancellable = t.status === 'Submitted' && t.currentHolderSub === null
  const dash = (v: string | null | undefined) => v || '—'

  // Fixed-position popup anchored to the button, so it escapes the table wrapper's
  // overflow clip (no cut-off, no upward "jump"). Close on any outside interaction.
  const openMenu = () => {
    const r = dotsRef.current?.getBoundingClientRect()
    if (r) {
      // Flip above the button when the viewport has no room below (fixed popup
      // would otherwise be cut off at the bottom edge).
      const estH = (cancellable ? 3 : 2) * 38 + 12
      const flipUp = window.innerHeight - r.bottom < estH + 8
      // Popup is right-aligned to `left` (translateX(-100%)); clamp so it can't
      // spill past the viewport edge on a narrow screen.
      setPos({ top: flipUp ? r.top - estH - 4 : r.bottom + 4, left: Math.min(r.right, window.innerWidth - 8) })
    }
    setMenu(true)
  }
  useEffect(() => {
    if (!menu) return
    // Move focus into the menu for keyboard users.
    popRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (popRef.current?.contains(target) || dotsRef.current?.contains(target)) return
      setMenu(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false)
        dotsRef.current?.focus()
      }
    }
    const close = () => setMenu(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  return (
    <Fragment>
      <tr
        className={`trow click${t.unseen ? ' new' : ''}${openId === t.id ? ' open' : ''}`}
        onClick={() => onToggle(t.id)}
        tabIndex={0}
        aria-expanded={openId === t.id}
        // Enter/Space toggle the row — but only when the row itself is focused, so
        // the nested code/menu buttons keep their own keyboard behaviour.
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle(t.id)
          }
        }}
      >
        <td className="seq" data-label={msg('tickets.myList.colSeq')}>{seq}</td>
        <td data-label={msg('tickets.myList.colCode')}>
          {t.unseen && (
            <span
              className="unseen"
              aria-label={msg('tickets.myList.unseenBadge')}
              title={msg('tickets.myList.unseenBadge')}
            />
          )}
          <button
            type="button"
            className="code"
            onClick={(e) => {
              e.stopPropagation()
              openTicketDetail(t.id)
            }}
          >
            {t.code ?? '—'}
          </button>
        </td>
        <td className="subj" data-label={msg('tickets.myList.colSubject')} title={t.description ?? undefined}>
          {dash(t.description)}
        </td>
        <td className="strong" data-label={msg('tickets.myList.colDocType')}>
          <span className={`fdot ${FLOW_CHIP[t.flow] ?? ''}`} title={t.flow} aria-hidden />
          {dash(t.documentType)}
        </td>
        <td className="strong" data-label={msg('tickets.myList.colContractor')}>{dash(t.contractor)}</td>
        <td className="mono" data-label={msg('tickets.myList.colContractNo')}>{dash(t.contractNo)}</td>
        <td data-label={msg('tickets.myList.colProjectTeam')}>{dash(t.projectTeam)}</td>
        <td className="num" data-label={msg('tickets.myList.colAmount')}>
          {t.amount ? (
            <>
              {groupAmount(t.amount, t.currency ?? 'VND')} <span className="u">{t.currency}</span>
            </>
          ) : (
            '—'
          )}
        </td>
        <td data-label={msg('tickets.myList.colPaymentTerm')}>{dash(t.paymentTerm)}</td>
        <td className="mono" data-label={msg('tickets.myList.colBudget')}>{dash(t.budgetCode)}</td>
        <td data-label={msg('tickets.myList.colStatus')}>
          <StatusCell status={t.status} />
        </td>
        <td className="act" data-label={msg('tickets.myList.colActions')}>
          <div className="rowmenu">
            <button
              ref={dotsRef}
              type="button"
              className="dots"
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label={msg('tickets.myList.menuAria', { code: t.code ?? '—' })}
              onClick={(e) => {
                e.stopPropagation()
                if (menu) setMenu(false)
                else openMenu()
              }}
            >
              <MoreVertical size={16} aria-hidden />
            </button>
            {menu && (
              <div
                ref={popRef}
                className="rowmenu-pop"
                role="menu"
                style={{ top: pos.top, left: pos.left }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenu(false)
                    onDetail(t.id)
                  }}
                >
                  {msg('tickets.myList.detailBtn')}
                </button>
                {cancellable && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenu(false)
                      onDetail(t.id) // Pool ticket → detail opens the editable field form
                    }}
                  >
                    {msg('tickets.myList.editBtn')}
                  </button>
                )}
                {RETURN_STATES.has(t.status) && (
                  <button
                    type="button"
                    role="menuitem"
                    className="warn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenu(false)
                      onDetail(t.id) // chi tiết mở thẳng ReturnPanel (xác nhận → sửa → nộp)
                    }}
                  >
                    {msg('tickets.myList.resubmitBtn')}
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenu(false)
                    onClone(t.id)
                  }}
                >
                  {msg('tickets.myList.cloneBtn')}
                </button>
                {cancellable && (
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenu(false)
                      onCancel(t.id)
                    }}
                  >
                    {msg('tickets.myList.cancelBtn')}
                  </button>
                )}
              </div>
            )}
          </div>
        </td>
      </tr>
      {openId === t.id && detail && detail.id === t.id && (
        <tr className="exprow">
          <td colSpan={COLS} style={{ padding: '0 14px 8px' }}>
            <div className="expwrap">
              {RETURN_STATES.has(detail.status) && (
                <ReturnPanel detail={detail} onDone={() => onReturnDone(detail.id)} />
              )}
              <RouteRail route={detail.route} directory={detail.directory} />
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}
