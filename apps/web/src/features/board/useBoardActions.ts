import { useRef, useState } from 'react'
import {
  batchAction,
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
import { summarizeBatch } from './bulkActions'
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
  // (Approve→Complete is irreversible); each ticket's result is independent.
  function doBatch(ids: string[], action: LegalAction, onDone: () => void) {
    setAsk({
      title: t('board.bulk.confirmTitle', { n: ids.length }),
      message: t('board.bulk.confirmMessage', { n: ids.length, action: primaryLabel(action) }),
      danger: true,
      confirmLabel: action.label,
      onOk: async () => {
        const results = await batchAction(ids, action.event)
        const { ok, failed } = summarizeBatch(results)
        if (ok === 0) toast.err(t('board.bulk.resultFail'))
        else if (failed > 0) toast.info(t('board.bulk.resultPartial', { ok, failed }))
        else toast.ok(t('board.bulk.resultOk', { n: ok }))
        onDone()
        await load()
      },
    })
  }

  return {
    handover, sendAcc, receiveAcc, ask, inFlight,
    setHandover, setSendAcc, setReceiveAcc, setAsk,
    run: guardedRun, doSeize, doReceive, doMissing, doSendAcc, doReceiveAcc,
    doBatch,
  }
}
