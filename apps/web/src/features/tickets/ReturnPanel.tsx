import { useState } from 'react'
import {
  confirmReturnReceipt,
  resubmitTicket,
  updateFields,
  type CreateTicketBody,
  type TicketDetail,
} from './api'
import { TicketFieldsFieldset } from './TicketFieldsFieldset'
import { displaySub } from '../../shared/format'
import { toast } from '../../shared/toast'
import { applyVp, t } from '../../i18n'

function toBody(d: TicketDetail): CreateTicketBody {
  return {
    documentType: d.documentType ?? 'General',
    description: d.description ?? '',
    paymentTerm: d.paymentTerm ?? '',
    // Contract flow shows a read-only 'N/A' until DCC2 assigns the number; coerce an
    // empty/legacy value to 'N/A' so what's shown matches what resubmit posts (the
    // backend rejects an empty Contract No).
    contractNo: d.contractNo || (d.flow === 'Contract' ? 'N/A' : ''),
    projectTeam: d.projectTeam ?? '',
    currency: d.currency ?? 'VND',
    amount: d.amount ?? '',
    budgetCode: d.budgetCode ?? '',
    contractor: d.contractor ?? '',
  }
}

/**
 * The Applicant side of Return (Story 2.2). At `Returned` it shows the reason and
 * a single confirm-receipt button (fields stay frozen); at `Return-fixing` it
 * opens the 9-field edit form + resubmit. Anti-double-submit via a busy flag.
 */
export function ReturnPanel({ detail, onDone }: { detail: TicketDetail; onDone: () => void }) {
  // Both a manual sendBack and an auto-return (overdue in Pool) land the ticket in a
  // return state with a stamped reason — surface either so the Applicant sees WHY.
  const lastReturn = [...detail.timeline]
    .reverse()
    .find((e) => e.action === 'sendBack' || e.action === 'auto_return')
  const [form, setForm] = useState<CreateTicketBody>(() => toBody(detail))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof CreateTicketBody, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function confirm() {
    if (busy) return
    setBusy(true)
    try {
      await confirmReturnReceipt(detail.id)
      toast.ok(t('tickets.returnPanel.confirmToast'))
      onDone()
    } catch {
      setError(t('tickets.returnPanel.errConfirm'))
    } finally {
      setBusy(false)
    }
  }

  async function saveAndResubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    // Two independent server calls — report them distinctly so a resubmit failure
    // never implies the (already-committed) field edits were lost.
    try {
      await updateFields(detail.id, form)
    } catch {
      setError(t('tickets.returnPanel.errSave'))
      setBusy(false)
      return
    }
    try {
      await resubmitTicket(detail.id)
      toast.ok(t('tickets.returnPanel.resubmitToast'))
      onDone()
    } catch {
      setError(t('tickets.returnPanel.errResubmit'))
      onDone() // refresh so the panel reflects the persisted edits
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="retbox">
      <div className="r1">
        <b>
          <span lang="en">{applyVp(detail.status)}</span>
          {t('tickets.returnPanel.needsFix')}
        </b>
        <span className="roundpill">{t('tickets.returnPanel.round', { n: detail.roundNo })}</span>
        {lastReturn && (
          <span className="actor">
            {displaySub(lastReturn.actorSub, detail.directory)} ·{' '}
            {new Date(lastReturn.occurredAt).toLocaleString('vi-VN')}
          </span>
        )}
      </div>
      {lastReturn && (
        <p className="retreason">
          <span className="rl">{t('tickets.returnPanel.reasonLabel')}</span> {lastReturn.reason ?? '—'}
        </p>
      )}

      {detail.status === 'Returned' && (
        <button type="button" className="btn warn" onClick={() => void confirm()} disabled={busy}>
          {busy ? t('tickets.returnPanel.confirming') : t('tickets.returnPanel.confirmBtn')}
        </button>
      )}

      {detail.status === 'Return-fixing' && (
        <form onSubmit={saveAndResubmit} className="fg">
          {/* Code is minted at Return-fixing → flow is fixed: pin Document Type to
              this flow and show the DCC-entered Contract No / Payment No read-only. */}
          <TicketFieldsFieldset
            form={form}
            set={set}
            lock={{ flow: detail.flow, contractNo: detail.contractNo, paymentNo: detail.paymentNo }}
          />
          <div className="field full">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? t('tickets.returnPanel.resubmitting') : t('tickets.returnPanel.resubmitBtn')}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="err">
          {error}
        </p>
      )}
    </section>
  )
}
