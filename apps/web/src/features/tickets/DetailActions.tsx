import { MoreVertical } from 'lucide-react'
import { TICKET_EVENT } from '@qlhs/contracts'
import { useBoardActions } from '../board/useBoardActions'
import { BoardActionModals } from '../board/BoardActionModals'
import { splitActions, primaryLabel } from '../board/primaryAction'
import { slaActionsFor } from '../board/slaPauseActions'
import { useDetailsMenu } from '../../shared/useDetailsMenu'
import type { BoardCard } from '../board/api'
import type { TicketDetail } from './api'
import { t } from '../../i18n'

/**
 * Same action surface as the board card (primary button + ⋯ menu), rendered in the
 * ticket-detail header so a DCC can act on a ticket while viewing it — not only from
 * the board. Actions = the server-derived `d.actions` (role-scoped state-machine
 * edges: forward step + Return/Reopen) PLUS the SLA clock control (pause/resume) the
 * holder gets, so the detail ⋯ matches the card. The other board-only pseudo-actions
 * (Pool "Nhận", reconcile, seize) stay on the board. Reuses the board's runner +
 * modals; success refetches the detail. Renders nothing when there's no action.
 */
export function DetailActions({ d, onDone }: { d: TicketDetail; onDone: () => Promise<void> }) {
  const {
    handover, sendAcc, receiveAcc, ask, inFlight,
    setHandover, setSendAcc, setReceiveAcc, setAsk,
    run, doReceive, doMissing, doSendAcc, doSkip, doReceiveAcc,
  } = useBoardActions(onDone)

  // Reopen is closed-lookup-only: it runs its own /reopen endpoint (reopen → sendBack,
  // fresh round), which the detail's generic /action dispatch can't carry — so a
  // reopen offered here just 400s. Drop it from the detail surface; a closed ticket is
  // reopened only from "Tra cứu hồ sơ" (ClosedTickets), which has its own reopen flow.
  const actions = d.actions.filter((a) => a.event !== TICKET_EVENT.Reopen)
  // A card-shaped view of the ticket for the shared runner/modals (they read
  // id/code/flow/mine/paused; the rest is filler the detail surface never shows).
  const card: BoardCard = {
    id: d.id,
    code: d.code,
    contractor: d.contractor,
    amount: d.amount,
    priority: 'normal',
    flow: d.flow,
    status: d.status,
    roundNo: d.roundNo,
    overdueDays: d.overdueDays,
    lockedByMe: false,
    lockedBy: null,
    actions,
    dupOf: [],
    paused: d.paused,
    mine: d.mine,
  }
  // Fold in the SLA clock control (holder-only) so the detail ⋯ carries "chờ bổ sung
  // SLA" / "chạy lại SLA" exactly like the board card at the same station.
  const { primary, menu } = splitActions([...actions, ...slaActionsFor(card)])
  const hasActions = primary.length > 0 || menu.length > 0
  // `present` must track when the ⋯ <details> is actually in the DOM: actions can
  // arrive AFTER mount via a live refetch, so the menu wiring re-attaches then.
  const { ref: detailsRef, onKeyDown } = useDetailsMenu<HTMLDetailsElement>({
    menuSelector: '.dactpop button:not([disabled])',
    summarySelector: '.dactdots',
    present: menu.length > 0,
  })

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
        doSkip={doSkip}
        doReceiveAcc={doReceiveAcc}
        onReload={onDone}
      />
    </>
  )
}
