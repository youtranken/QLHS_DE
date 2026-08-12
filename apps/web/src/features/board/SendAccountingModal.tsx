import { useState } from 'react'
import { X } from 'lucide-react'
import { ApiClientError } from '../../shared/api-client'
import { ConfirmModal } from '../../shared/ConfirmModal'
import { useFocusTrap } from '../../shared/useFocusTrap'
import { useBackdropClose } from '../../shared/useBackdropClose'
import { t } from '../../i18n'

export interface SendAccountingModalProps {
  code: string
  onSubmit: (documentNo: string) => Promise<void>
  onClose: () => void
  /** Field label — flow-aware: "Contract No" (DCC2/Contract) vs "Payment number"
   *  (DCC3/Payment); the value entered differs by flow though the column is shared. */
  docLabel?: string
  /** Payment closes irreversibly at `Sent to Accounting` (H5), so gate the send
   *  behind a "close ticket?" confirm. No scary warning paragraph — just the gate. */
  confirmClose?: boolean
  /** Contract No is normalised to uppercase as you type (DCC2); Payment No isn't. */
  uppercase?: boolean
}

/**
 * DCC2/DCC3 entry of the contract/payment number before sending to Accounting
 * (FR-11) — the field label is flow-aware (see `docLabel`). Empty is blocked
 * client-side (aria-invalid + role=alert); the server's DB UNIQUE index is the
 * real guard — a 409 duplicate is surfaced in the same alert.
 */
export function SendAccountingModal({
  code,
  onSubmit,
  onClose,
  confirmClose = false,
  uppercase = false,
  // Default keeps standalone usage sensible; StationBoard overrides it per flow.
  docLabel = t('board.modals.sendAccounting.docNoLabel'),
}: SendAccountingModalProps) {
  const { ref, onKeyDown } = useFocusTrap<HTMLDivElement>(onClose)
  const [documentNo, setDocumentNo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Payment closes the ticket for good at "Sent to Accounting" (confirmClose) — gate
  // it behind an explicit danger confirm instead of a passive warning line (H5).
  const [confirming, setConfirming] = useState(false)
  // A drag-select ending on the overlay must not throw away the typed value.
  const backdrop = useBackdropClose(() => {
    if (!busy) onClose()
  })

  function submit() {
    if (busy) return
    const value = documentNo.trim()
    if (value === '') {
      setError(t('board.modals.sendAccounting.emptyError', { field: docLabel }))
      return
    }
    // Irreversible branch (Payment) → confirm closing the ticket before posting.
    if (confirmClose) {
      setError(null)
      setConfirming(true)
      return
    }
    void doSubmit(value)
  }

  async function doSubmit(value: string) {
    setConfirming(false)
    setBusy(true)
    setError(null)
    try {
      await onSubmit(value)
    } catch (e) {
      setError(
        e instanceof ApiClientError && e.code === 'DocumentNoDuplicate'
          ? t('board.modals.sendAccounting.duplicateError', { value, field: docLabel })
          : t('board.modals.sendAccounting.failError'),
      )
      setBusy(false)
    }
  }

  const invalid = error !== null
  return (
    <div role="presentation" className="overlay" onKeyDown={onKeyDown} {...backdrop}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-acc-title"
        className="modal sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt">
          <span className="ttl" id="send-acc-title">
            {t('board.modals.sendAccounting.title')} · <span className="mono accent">{code}</span>
          </span>
          <button type="button" className="x" aria-label={t('board.modals.close')} onClick={onClose}>
            <X size={15} aria-hidden />
          </button>
        </div>
        <div className="mb">
          <div className="field">
            <label htmlFor="send-acc-docno">
              {docLabel} <span className="req">*</span>
            </label>
            <input
              id="send-acc-docno"
              value={documentNo}
              onChange={(e) => {
                setDocumentNo(uppercase ? e.target.value.toUpperCase() : e.target.value)
                if (error) setError(null)
              }}
              aria-required="true"
              aria-invalid={invalid}
              aria-describedby={invalid ? 'send-acc-error' : undefined}
              className="mono"
            />
          </div>
          {invalid && (
            <p id="send-acc-error" role="alert" className="err">
              {error}
            </p>
          )}
        </div>
        <div className="mf">
          <button type="button" className="btn ghost" onClick={onClose}>
            {t('board.modals.cancel')}
          </button>
          <span className="sp" />
          <button type="button" className="btn primary" disabled={busy} onClick={submit}>
            {t('board.modals.sendAccounting.submit')}
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmModal
          title={t('board.modals.sendAccounting.confirmTitle')}
          message={t('board.modals.sendAccounting.confirmMessage')}
          code={code}
          danger
          confirmLabel={t('board.modals.sendAccounting.confirmSubmit')}
          onConfirm={() => doSubmit(documentNo.trim())}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
