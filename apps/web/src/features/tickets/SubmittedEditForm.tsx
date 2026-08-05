import { useState } from 'react'
import { updateFields, type CreateTicketBody, type TicketDetail } from './api'
import { TicketFieldsFieldset } from './TicketFieldsFieldset'
import { ApiClientError } from '../../shared/api-client'
import { toast } from '../../shared/toast'
import { t } from '../../i18n'

function toBody(d: TicketDetail): CreateTicketBody {
  return {
    documentType: d.documentType ?? 'General',
    description: d.description ?? '',
    paymentTerm: d.paymentTerm ?? '',
    contractNo: d.contractNo ?? '',
    projectTeam: d.projectTeam ?? '',
    currency: d.currency ?? 'VND',
    amount: d.amount ?? '',
    budgetCode: d.budgetCode ?? '',
    contractor: d.contractor ?? '',
  }
}

/** Edit the 9 fields while the ticket is still in the Pool (Submitted). Persists via
 *  the same PATCH the return flow uses — status stays Submitted, each change audited. */
export function SubmittedEditForm({
  detail,
  onDone,
  onCancel,
}: {
  detail: TicketDetail
  onDone: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<CreateTicketBody>(() => toBody(detail))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof CreateTicketBody, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await updateFields(detail.id, form)
      toast.ok(t('tickets.detail.savedToast'))
      onDone()
    } catch (err) {
      // DCC1 may have picked the ticket mid-edit → it left the editable window; the
      // fields are no longer mutable, so close & reload rather than dead-ending.
      if (err instanceof ApiClientError && err.code === 'FieldsLocked') {
        toast.err(t('tickets.detail.editLocked'))
        onDone()
        return
      }
      setError(t('tickets.detail.saveErr'))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="editbox fg">
      <TicketFieldsFieldset form={form} set={set} />
      {error && (
        <p role="alert" className="err editerr">
          {error}
        </p>
      )}
      <div className="field full editactions">
        <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
          {t('common.actions.cancel')}
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? t('tickets.detail.saving') : t('tickets.detail.saveBtn')}
        </button>
      </div>
    </form>
  )
}
