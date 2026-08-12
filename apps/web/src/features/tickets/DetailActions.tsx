import { MoreVertical } from 'lucide-react'
import { useBoardActions } from '../board/useBoardActions'
import { BoardActionModals } from '../board/BoardActionModals'
import { splitActions, primaryLabel } from '../board/primaryAction'
import { useDetailsMenu } from '../../shared/useDetailsMenu'
import type { BoardCard } from '../board/api'
import type { TicketDetail } from './api'
import { t } from '../../i18n'

/**
 * Same action surface as the board card (primary button + ⋯ menu), rendered in the
 * ticket-detail header so a DCC can act on a ticket while viewing it — not only from
 * the board. Actions come from the server-derived `d.actions` (role-scoped, pure
 * state-machine edges: forward step + Return/Reopen; the board-only pseudo-actions —
 * Pool "Nhận", reconcile, SLA pause, seize — stay on the board). Reuses the board's
 * action runner + modals; success refetches the detail. Renders nothing when the
 * viewer has no legal action here.
 */
export function DetailActions({ d, onDone }: { d: TicketDetail; onDone: () => Promise<void> }) {
  const {
    handover, sendAcc, receiveAcc, ask, inFlight,
    setHandover, setSendAcc, setReceiveAcc, setAsk,
    run, doReceive, doMissing, doSendAcc, doReceiveAcc,
  } = useBoardActions(onDone)
  const { ref: detailsRef, onKeyDown } = useDetailsMenu<HTMLDetailsElement>({
    menuSelector: '.dactpop button:not([disabled])',
    summarySelector: '.dactdots',
  })

  const { primary, menu } = splitActions(d.actions)
  const hasActions = primary.length > 0 || menu.length > 0

  // A card-shaped view of the ticket for the shared runner/modals (they read
  // id/code/flow; the rest is filler the detail surface never shows).
  const card: BoardCard = {
    id: d.id,
    code: d.code,
    contractor: d.contractor,
    amount: d.amount,
    priority: 'normal',
    flow: d.flow,
    status: d.status,
    overdueDays: d.overdueDays,
    lockedByMe: false,
    lockedBy: null,
    actions: d.actions,
    dupOf: [],
    paused: d.paused,
    mine: false,
  }
  const busy = inFlight.has(d.id)
  const closeMenu = () => detailsRef.current?.removeAttribute('open')

  // The modals render from a stable spot regardless of `hasActions`: a live refetch
  // can flip d.actions to empty mid-interaction, and an open handover/confirm modal
  // (with a half-typed reason) must NOT be torn down just because the buttons vanished.
  return (
    <>
      {hasActions && (
        <div className="dactions">
          {primary.map((a) => (
            <button
              key={a.event}
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => void run(card, a)}
            >
              {primaryLabel(a)}
            </button>
          ))}
          {menu.length > 0 && (
            <details ref={detailsRef} className="dactmenu" onKeyDown={onKeyDown}>
              <summary className="dactdots" tabIndex={0} aria-label={t('board.menu.aria')} aria-busy={busy}>
                <MoreVertical size={16} aria-hidden />
              </summary>
              <div className="dactpop">
                {menu.map((a) => (
                  <button
                    key={a.event}
                    type="button"
                    disabled={busy}
                    className={a.reasonRequired ? 'danger' : undefined}
                    onClick={() => {
                      closeMenu()
                      void run(card, a)
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      <BoardActionModals
        handover={handover}
        sendAcc={sendAcc}
        receiveAcc={receiveAcc}
        ask={ask}
        setHandover={setHandover}
        setSendAcc={setSendAcc}
        setReceiveAcc={setReceiveAcc}
        setAsk={setAsk}
        doReceive={doReceive}
        doMissing={doMissing}
        doSendAcc={doSendAcc}
        doReceiveAcc={doReceiveAcc}
        onReload={onDone}
      />
    </>
  )
}
