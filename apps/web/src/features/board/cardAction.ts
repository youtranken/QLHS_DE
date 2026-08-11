import {
  actionCard,
  confirmCard,
  pauseSla,
  pickCard,
  resendDcc2,
  resendDcc3,
  resumeSla,
  returnPushback,
  type BoardCard,
  type LegalAction,
} from './api'
import { PAUSE_EVENT, RESUME_EVENT } from './slaPauseActions'
import type { Ask } from './ask'
import { messageOf } from '../../shared/errorMessage'
import { toast } from '../../shared/toast'
import { t } from '../../i18n'

export interface CardActionDeps {
  setAsk: (a: Ask | null) => void
  setHandover: (c: BoardCard | null) => void
  setSendAcc: (c: BoardCard | null) => void
  setReceiveAcc: (c: BoardCard | null) => void
  setComplete: (c: BoardCard | null) => void
  /** Reversible actions offer a 5s Undo via an action toast (backend enforces 5s). */
  onUndo: (id: string) => void | Promise<void>
  load: () => Promise<void>
}

/** One-line consequence for an irreversible action (UX-DR15). */
function consequence(action: LegalAction): string {
  if (action.toStatus === 'Completed') return t('board.consequence.completed')
  if (action.event === 'reopen') return t('board.consequence.reopen')
  return t('board.consequence.irreversible')
}

/**
 * Routes a card's ⋯ action to the right call: a direct transition, a modal that
 * must collect something first (handover date, Document No, scan path), or a
 * confirm/reason gate. Extracted from StationBoard so that component stays a
 * layout — this is the whole decision table in one place.
 */
export function makeCardAction({
  setAsk, setHandover, setSendAcc, setReceiveAcc, setComplete, onUndo, load,
}: CardActionDeps) {
  return async function run(card: BoardCard, action: LegalAction): Promise<void> {
    const code = card.code ?? card.id.slice(0, 8)
    try {
      if (action.event === '__pick') {
        await pickCard(card.id)
      } else if (action.event === '__confirm') {
        const r = await confirmCard(card.id)
        toast.ok(t('board.toasts.codeGenerated', { code: r.code }))
      } else if (action.event === '__resend') {
        await resendDcc2(card.id)
        toast.ok(t('board.toasts.resentDcc2'))
      } else if (action.event === '__resend-dcc3') {
        await resendDcc3(card.id)
        toast.ok(t('board.toasts.resentDcc3'))
      } else if (action.event === 'confirmReceivedByDcc2' || action.event === 'confirmReceivedByDcc3') {
        setHandover(card) // open the 2-phase modal instead of a blind transition
        return
      } else if (action.event === 'sendToAccounting') {
        setSendAcc(card) // open the Document No entry form
        return
      } else if (action.event === 'receiveFromAcc') {
        setReceiveAcc(card) // open the dated receipt modal
        return
      } else if (action.event === 'completeContract') {
        setComplete(card) // open the scan-path form
        return
      } else if (action.event === '__return') {
        setAsk({
          title: t('board.ask.returnTitle'),
          message: t('board.ask.returnMessage'),
          code,
          reason: true,
          danger: true,
          confirmLabel: t('board.ask.returnConfirm'),
          onOk: async (reason) => {
            await returnPushback(card.id, reason ?? '')
            toast.ok(t('board.toasts.returnedToApplicant'))
            await load()
          },
        })
        return
      } else if (action.event === PAUSE_EVENT) {
        // F8 — stopping the clock demands a stated reason; it is what Admin later
        // reviews when checking whether a station leans on pause too often.
        setAsk({
          title: t('board.ask.pauseTitle'),
          message: t('board.ask.pauseMessage'),
          code,
          reason: true,
          confirmLabel: t('board.ask.pauseConfirm'),
          onOk: async (reason) => {
            await pauseSla(card.id, reason ?? '')
            toast.ok(t('board.toasts.slaPaused'))
            await load()
          },
        })
        return
      } else if (action.event === RESUME_EVENT) {
        await resumeSla(card.id)
        toast.ok(t('board.toasts.slaResumed'))
      } else if (action.reasonRequired) {
        // Reason-gated action (e.g. reject) → collect a required reason. When F12
        // flagged this card, seed the reason with what it matched so DCC1 doesn't
        // retype it (still editable — the duplicate may not be the real cause).
        const dup = card.dupOf?.[0]
        setAsk({
          title: action.label,
          message: t('board.ask.reasonMessage'),
          // Only a real minted code — a Pool ticket has none, and showing the raw
          // internal id (e.g. "b15b16e1") in the dialog just confused DCC1.
          code: card.code ?? undefined,
          reason: true,
          reasonDefault: dup
            ? t('board.ask.reasonDupDefault', { code: dup.code ?? dup.id.slice(0, 8) })
            : undefined,
          danger: true,
          confirmLabel: action.label,
          onOk: async (reason) => {
            await actionCard(card.id, action.event, reason)
            toast.ok(t('board.toasts.done'))
            await load()
          },
        })
        return
      } else if (!action.reversible) {
        // Irreversible & not reason-gated (e.g. Completed) → confirm consequence (AC3).
        setAsk({
          title: t('board.ask.confirmTitle'),
          message: consequence(action),
          code,
          danger: true,
          confirmLabel: action.label,
          onOk: async () => {
            await actionCard(card.id, action.event)
            toast.ok(t('board.toasts.done'))
            await load()
          },
        })
        return
      } else {
        // Reversible → run now, then offer a 5s Undo (AD-19 / UX-DR15).
        await actionCard(card.id, action.event)
        toast.action(t('board.toasts.done'), {
          label: t('board.toasts.undoButton'),
          run: () => onUndo(card.id),
        })
      }
    } catch (e) {
      toast.err(messageOf(e, t('board.toasts.actionFailed')))
    }
    await load()
  }
}
