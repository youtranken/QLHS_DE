import { useRef, useState } from 'react'
import {
  batchAction,
  batchDcc2Action,
  batchDcc3Action,
  missingPaperDcc2,
  missingPaperDcc3,
  receiveDcc2,
  receiveDcc3,
  receiveFromAcc,
  seizeCard,
  sendAccounting,
  sendAccountingDcc3,
  undoCard,
  type BoardCard,
  type LegalAction,
} from './api'
import { makeCardAction } from './cardAction'
import { summarizeBatch, HANDOVER_DCC, handoverEventOf } from './bulkActions'
import { primaryLabel } from './primaryAction'
import type { Ask } from './ask'
import { toast } from '../../shared/toast'
import { t } from '../../i18n'

/**
 * The board's whole action surface, lifted out of StationBoard so that component
 * stays a layout: it owns which modal is open, which cards have a POST in flight,
 * and every handler that mutates a card. `load` refetches the columns.
 */
export function useBoardActions(load: () => Promise<void>) {
  const [handover, setHandover] = useState<BoardCard | null>(null)
  const [sendAcc, setSendAcc] = useState<BoardCard | null>(null)
  const [receiveAcc, setReceiveAcc] = useState<BoardCard | null>(null)
  const [ask, setAsk] = useState<Ask | null>(null)
  // Cards with a POST in flight — the ⋯ launcher disables them so a double-click
  // can't double-pick or mint two codes (the direct-transition path has no modal
  // busy guard of its own). The ref is the SYNCHRONOUS gate (two clicks in one
  // tick both read stale state before a re-render); the Set drives the `busy` prop.
  const inFlightRef = useRef<Set<string>>(new Set())
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set())

  const markBusy = (id: string) => {
    inFlightRef.current.add(id)
    setInFlight((s) => new Set(s).add(id))
  }
  const clearBusy = (id: string) => {
    inFlightRef.current.delete(id)
    setInFlight((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
  }

  async function doUndo(id: string) {
    try {
      await undoCard(id)
      toast.ok(t('board.toasts.undone'))
    } catch {
      toast.err(t('board.toasts.undoFailed'))
    }
    await load()
  }

  const run = makeCardAction({
    setAsk, setHandover, setSendAcc, setReceiveAcc, onUndo: doUndo, load,
  })

  // Serialise per-card: ignore a click while that card already has work in flight.
  async function guardedRun(card: BoardCard, action: LegalAction) {
    if (inFlightRef.current.has(card.id)) return
    markBusy(card.id)
    try {
      await run(card, action)
    } finally {
      clearBusy(card.id)
    }
  }

  async function doSeize(id: string) {
    if (inFlightRef.current.has(id)) return
    markBusy(id)
    try {
      const { acquired } = await seizeCard(id)
      toast[acquired ? 'ok' : 'err'](
        acquired ? t('board.toasts.seized') : t('board.toasts.seizeFailed'),
      )
      await load()
    } catch {
      toast.err(t('board.toasts.seizeFailed'))
    } finally {
      clearBusy(id)
    }
  }

  async function doReceive(card: BoardCard, receivedAt: string) {
    try {
      await (card.flow === 'Payment' ? receiveDcc3 : receiveDcc2)(card.id, receivedAt)
      toast.ok(t('board.toasts.receivedHardcopy'))
    } catch {
      toast.err(t('board.toasts.confirmFailed'))
    }
    setHandover(null)
    await load()
  }

  async function doMissing(card: BoardCard, reason: string) {
    try {
      await (card.flow === 'Payment' ? missingPaperDcc3 : missingPaperDcc2)(card.id, reason)
      toast.ok(t('board.toasts.missingReported'))
    } catch {
      toast.err(t('board.toasts.actionFailed'))
    }
    setHandover(null)
    await load()
  }

  async function doSendAcc(card: BoardCard, documentNo: string) {
    // Let errors propagate so the modal can show the 409 duplicate / format alert.
    await (card.flow === 'Payment' ? sendAccountingDcc3 : sendAccounting)(card.id, documentNo)
    setSendAcc(null)
    toast.ok(card.flow === 'Payment' ? t('board.toasts.sentAccPaymentClosed') : t('board.toasts.sentAcc'))
    await load()
  }

  async function doReceiveAcc(card: BoardCard, receivedAt: string) {
    try {
      await receiveFromAcc(card.id, receivedAt)
      toast.ok(t('board.toasts.receivedFromAcc'))
    } catch {
      toast.err(t('board.toasts.confirmFailed'))
    }
    setReceiveAcc(null)
    await load()
  }

  // FR-8 — one Andy decision applied to many tickets. Gated behind a confirm
  // (Approve→Complete is irreversible); each ticket's result is independent. The
  // "Chuyển cho DCC" umbrella spans two events (Contract→DCC2, Payment→DCC3), so
  // it fans out into one batch call per event and merges the results.
  function doBatch(
    cards: BoardCard[],
    action: LegalAction,
    onDone: () => void,
    opts: { alsoComplete?: boolean } = {},
  ) {
    setAsk({
      title: t('board.bulk.confirmTitle', { n: cards.length }),
      message: t('board.bulk.confirmMessage', { n: cards.length, action: primaryLabel(action) }),
      danger: true,
      confirmLabel: action.label,
      onOk: async () => {
        const results = await runBatch(cards, action, opts)
        const { ok, failed } = summarizeBatch(results)
        if (ok === 0) toast.err(t('board.bulk.resultFail'))
        else if (failed > 0) toast.info(t('board.bulk.resultPartial', { ok, failed }))
        else toast.ok(t('board.bulk.resultOk', { n: ok }))
        onDone()
        await load()
      },
    })
  }

  // Route a bulk action to the right endpoint: the "hand to DCC" umbrella, the DCC2
  // hardcopy endpoint (confirm / complete), or the generic DCC1 batch. For the DCC2
  // "Hoàn tất luôn" shortcut, confirm first, then complete the ones that reached
  // Hardcopy — the two-phase edge is preserved, just driven in one click.
  async function runBatch(cards: BoardCard[], action: LegalAction, opts: { alsoComplete?: boolean }) {
    if (action.event === HANDOVER_DCC) return batchByHandover(cards)
    const ids = cards.map((c) => c.id)
    if (action.event === 'confirmReceivedByDcc2' || action.event === 'completeContract') {
      const confirmed = await batchDcc2Action(ids, action.event)
      if (!opts.alsoComplete || action.event !== 'confirmReceivedByDcc2') return confirmed
      // Only chain complete for tickets whose confirm reached Hardcopy (the post-BOP
      // handover). The FIRST handover's confirm lands at Received-by-DCC2, which
      // can't be completed — so "Hoàn tất luôn" is a harmless no-op there.
      const okIds = confirmed.filter((r) => r.ok && r.status === 'Hardcopy').map((r) => r.id)
      if (okIds.length === 0) return confirmed
      const done = await batchDcc2Action(okIds, 'completeContract')
      const doneById = new Map(done.map((d) => [d.id, d]))
      return confirmed.map((r) => doneById.get(r.id) ?? r)
    }
    if (action.event === 'confirmReceivedByDcc3') return batchDcc3Action(ids, action.event)
    return batchAction(ids, action.event)
  }

  // Route each card to its own flow's handover event (DCC2 vs DCC3), one batch call
  // per event, then flatten so summarizeBatch tallies the whole selection at once.
  // allSettled (not all): if ONE flow-group's POST rejects at the transport level
  // while the other succeeded, we must still report the successes honestly and count
  // the rejected group as failed — never discard a group that already applied and
  // tell the user the whole batch failed (which would invite a re-fire).
  async function batchByHandover(cards: BoardCard[]) {
    const groups = new Map<string, string[]>()
    const unmatched: string[] = []
    for (const c of cards) {
      const ev = handoverEventOf(c)
      if (ev) groups.set(ev, [...(groups.get(ev) ?? []), c.id])
      else unmatched.push(c.id)
    }
    const entries = [...groups]
    const settled = await Promise.allSettled(entries.map(([ev, ids]) => batchAction(ids, ev)))
    const results: { id: string; ok: boolean }[] = []
    settled.forEach((s, i) => {
      const ids = entries[i]![1]
      if (s.status === 'fulfilled') results.push(...s.value)
      else results.push(...ids.map((id) => ({ id, ok: false })))
    })
    // commonBulkActions guarantees every selected card carries a handover event, but
    // count any stray unmatched card as failed so the tally always sums to the selection.
    for (const id of unmatched) results.push({ id, ok: false })
    return results
  }

  return {
    handover, sendAcc, receiveAcc, ask, inFlight,
    setHandover, setSendAcc, setReceiveAcc, setAsk,
    run: guardedRun, doSeize, doReceive, doMissing, doSendAcc, doReceiveAcc,
    doBatch,
  }
}
