import { useState } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../shared/useFocusTrap'
import { useBackdropClose } from '../../shared/useBackdropClose'
import { ApiClientError } from '../../shared/api-client'
import { groupAmount } from '../../shared/format'
import { checkDocumentNos, sendAccounting, sendAccountingDcc3, type BoardCard } from './api'
import { toast } from '../../shared/toast'
import { t } from '../../i18n'

export interface BatchSendAccountingModalProps {
  /** All tickets in a "Received by DCC2/DCC3" column (single flow). */
  cards: BoardCard[]
  onClose: () => void
  /** Refetch the board after any row succeeds. */
  onDone: () => Promise<void>
}

/**
 * Enter the Contract No / Payment No for MANY tickets on one screen, then send
 * them all. The number differs per ticket (so a single bulk action can't do it),
 * but typing them one modal-at-a-time is the real drag. Rows left BLANK are simply
 * skipped and stay in the column. Duplicates are caught BEFORE anything is sent —
 * the same number typed on two rows is flagged live, and a number already taken on
 * another ticket is caught by a pre-flight check on submit — so a known clash never
 * half-sends the batch and strands one hard-to-spot row.
 */
export function BatchSendAccountingModal({ cards, onClose, onDone }: BatchSendAccountingModalProps) {
  const isPayment = cards[0]?.flow === 'Payment'
  const flow = isPayment ? 'Payment' : 'Contract'
  const docLabel = isPayment
    ? t('board.modals.sendAccounting.payNoLabel')
    : t('board.modals.sendAccounting.docNoLabel')
  const send = isPayment ? sendAccountingDcc3 : sendAccounting
  // Both Contract No and Payment No are normalised to uppercase, matching the server
  // (MED-2) so the case-insensitive unique index can't be bypassed by case.
  const norm = (v: string) => v.toUpperCase()

  const [vals, setVals] = useState<Record<string, string>>({})
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  // A send loop in flight must not be torn down by ESC or a backdrop click.
  const close = () => {
    if (!busy) onClose()
  }
  const { ref, onKeyDown } = useFocusTrap<HTMLDivElement>(close)
  const backdrop = useBackdropClose(close)

  // Succeeded rows drop off the list; blanks remain for later.
  const rows = cards.filter((c) => !done[c.id])
  const filled = rows.filter((c) => (vals[c.id] ?? '').trim())

  // Live intra-batch clash: the same number typed on ≥2 rows. Caught as you type
  // (before submit) — the send button is disabled while any row is in this set.
  const listDup = new Set<string>()
  const byVal = new Map<string, string[]>()
  for (const c of filled) {
    const v = (vals[c.id] ?? '').trim()
    byVal.set(v, [...(byVal.get(v) ?? []), c.id])
  }
  for (const ids of byVal.values()) if (ids.length > 1) ids.forEach((id) => listDup.add(id))
  const rowErr = (id: string): string | undefined =>
    errs[id] ?? (listDup.has(id) ? t('board.modals.batchAcc.dupInList') : undefined)
  const blocked = busy || filled.length === 0 || listDup.size > 0

  async function submit() {
    if (blocked) return
    setBusy(true)
    // Pre-flight: catch a Document No already taken on another ticket BEFORE sending
    // anything, so a known clash never half-sends the batch. Best-effort — if the
    // check itself fails, fall through to the send (the DB unique index still guards).
    try {
      const { existing } = await checkDocumentNos(filled.map((c) => (vals[c.id] ?? '').trim()), flow)
      if (existing.length > 0) {
        const taken = new Set(existing)
        const dupErrs: Record<string, string> = {}
        for (const c of filled) {
          const value = (vals[c.id] ?? '').trim()
          if (taken.has(value)) {
            dupErrs[c.id] = t('board.modals.sendAccounting.duplicateError', { value, field: docLabel })
          }
        }
        setErrs(dupErrs)
        setBusy(false)
        toast.err(t('board.modals.batchAcc.dupBlocked'))
        return
      }
    } catch {
      // pre-check unavailable → proceed; the per-row send still surfaces any clash.
    }

    const nextDone = { ...done }
    const nextErrs: Record<string, string> = {}
    let ok = 0
    for (const c of filled) {
      const value = (vals[c.id] ?? '').trim()
      try {
        await send(c.id, value)
        nextDone[c.id] = true
        ok += 1
      } catch (e) {
        nextErrs[c.id] =
          e instanceof ApiClientError && e.code === 'DocumentNoDuplicate'
            ? t('board.modals.sendAccounting.duplicateError', { value, field: docLabel })
            : t('board.modals.sendAccounting.failError')
      }
    }
    setDone(nextDone)
    setErrs(nextErrs)
    setBusy(false)
    if (ok > 0) await onDone() // refresh the board so the sent tickets leave the column

    const failed = Object.keys(nextErrs).length
    if (ok > 0 && failed === 0) {
      toast.ok(t('board.modals.batchAcc.sentToast', { n: ok }))
      onClose()
    } else if (ok > 0) {
      toast.info(t('board.modals.batchAcc.partialToast', { ok, failed }))
    } else {
      toast.err(t('board.modals.batchAcc.failToast'))
    }
  }

  return (
    <div role="presentation" className="overlay" onKeyDown={onKeyDown} {...backdrop}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-acc-title"
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt">
          <span className="ttl" id="batch-acc-title">
            {t('board.modals.batchAcc.title', { field: docLabel })}
          </span>
          <button type="button" className="x" aria-label={t('board.modals.close')} disabled={busy} onClick={onClose}>
            <X size={15} aria-hidden />
          </button>
        </div>
        <div className="mb">
          <p>{t('board.modals.batchAcc.hint', { field: docLabel })}</p>
          <div className="batchtbl">
            <div className="batchrow batchhead" aria-hidden>
              <span>{t('board.modals.batchAcc.colCode')}</span>
              <span>{t('board.modals.batchAcc.colContractor')}</span>
              <span className="ba">{t('board.modals.batchAcc.colAmount')}</span>
              <span>{docLabel}</span>
            </div>
            {rows.map((c) => (
              <div className={`batchrow${rowErr(c.id) ? ' bad' : ''}`} key={c.id}>
                <span className="bc mono">{c.code ?? c.id.slice(0, 8)}</span>
                <span className="bw" title={c.contractor ?? undefined}>{c.contractor ?? '—'}</span>
                <span className="ba mono">{c.amount ? groupAmount(c.amount) : ''}</span>
                <input
                  className="mono"
                  value={vals[c.id] ?? ''}
                  disabled={busy}
                  aria-invalid={!!rowErr(c.id)}
                  aria-label={t('board.modals.batchAcc.inputAria', { field: docLabel, code: c.code ?? '' })}
                  placeholder={docLabel}
                  onChange={(e) => {
                    const v = norm(e.target.value)
                    setVals((prev) => ({ ...prev, [c.id]: v }))
                    if (errs[c.id]) setErrs((prev) => {
                      const n = { ...prev }
                      delete n[c.id]
                      return n
                    })
                  }}
                />
                {rowErr(c.id) && (
                  <span className="err batcherr" role="alert">{rowErr(c.id)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mf">
          <button type="button" className="btn ghost" disabled={busy} onClick={onClose}>
            {t('board.modals.close')}
          </button>
          <span className="sp" />
          <span className="batchcount">
            {t('board.modals.batchAcc.count', { n: filled.length, total: rows.length })}
          </span>
          <button type="button" className="btn primary" disabled={blocked} onClick={() => void submit()}>
            {t('board.modals.batchAcc.submit', { n: filled.length })}
          </button>
        </div>
      </div>
    </div>
  )
}
