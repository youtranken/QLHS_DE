import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { ApiClientError } from '../../shared/api-client'
import { ConfirmModal } from '../../shared/ConfirmModal'
import { useFocusTrap } from '../../shared/useFocusTrap'
import { useBackdropClose } from '../../shared/useBackdropClose'
import { t } from '../../i18n'

export interface SendAccountingModalProps {
  code: string
  onSubmit: (documentNo: string) => Promise<void>
  onClose: () => void
  /** Field label — flow-aware: "Contract No" (DCC2/Contract) vs "Payment No"
   *  (DCC3/Payment); the value entered differs by flow though the column is shared. */
  docLabel?: string
  /** Payment closes irreversibly at `Sent to Accounting` (H5), so gate the send
   *  behind a "close ticket?" confirm. No scary warning paragraph — just the gate. */
  confirmClose?: boolean
  /** Both Contract No (DCC2) and Payment No (DCC3) are normalised to uppercase as you
   *  type, matching the server (MED-2) so the field shows exactly what is stored. */
  uppercase?: boolean
  /** Loại luồng Contract có bật `requiresContractNo` (hoặc Payment) → hiện ô nhập số
   *  và bắt buộc. Loại chỉ-Skip (không yêu cầu số) → ẩn ô, chỉ còn checkbox Skip;
   *  không tick vẫn "Gửi Accounting" bình thường (server lưu 'N/A'). */
  requireDocNo?: boolean
  /** DCC2/Contract only: show the "Skip Completed" checkbox. When ticked the ticket
   *  fast-forwards past ACC + BOP straight to Completed and Contract No is optional. */
  allowSkip?: boolean
  /** Called instead of onSubmit when "Skip Completed" is ticked (value may be ''). */
  onSkip?: (documentNo: string) => Promise<void>
}

/**
 * DCC2/DCC3 entry of the contract/payment number before sending to Accounting
 * (FR-11) — the field label is flow-aware (see `docLabel`). Empty is blocked
 * client-side (aria-invalid + role=alert); the server's DB UNIQUE index is the
 * real guard — a 409 duplicate is surfaced in the same alert. With `allowSkip`,
 * a "Skip Completed" checkbox lets DCC2 fast-forward a Contract to Completed
 * (ACC/BOP run server-side) behind an irreversible-action confirm.
 */
export function SendAccountingModal({
  code,
  onSubmit,
  onClose,
  confirmClose = false,
  uppercase = false,
  requireDocNo = true,
  allowSkip = false,
  onSkip,
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
  // "Skip Completed" — bypasses ACC/BOP straight to Completed; makes Contract No
  // optional and routes submit through its own irreversible-action confirm.
  const [skip, setSkip] = useState(false)
  const [skipConfirming, setSkipConfirming] = useState(false)
  // A drag-select ending on the overlay must not throw away the typed value.
  const backdrop = useBackdropClose(() => {
    if (!busy) onClose()
  })

  // Guard on onSkip too: allowSkip without an onSkip handler must not enter the
  // skip path (else the confirm's onConfirm would no-op and leave the dialog stuck).
  const skipping = allowSkip && !!onSkip && skip

  function submit() {
    if (busy) return
    const value = documentNo.trim()
    // Số bắt buộc khi loại yêu cầu (requiresContractNo/Payment) — áp cho CẢ đường Skip:
    // loại cả-hai-cờ (Service Contract) phải nhập số rồi mới Skip → Completed. Loại
    // chỉ-Skip (requireDocNo=false) không có ô số nên bỏ qua, skip trống → N/A.
    if (requireDocNo && value === '') {
      setError(t('board.modals.sendAccounting.emptyError', { field: docLabel }))
      return
    }
    if (skipping) {
      setError(null)
      setSkipConfirming(true)
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

  async function run(value: string, action: (v: string) => Promise<void>) {
    setConfirming(false)
    setSkipConfirming(false)
    setBusy(true)
    setError(null)
    try {
      await action(value)
    } catch (e) {
      setError(
        e instanceof ApiClientError && e.code === 'DocumentNoDuplicate'
          ? t('board.modals.sendAccounting.duplicateError', { value, field: docLabel })
          : t('board.modals.sendAccounting.failError'),
      )
      setBusy(false)
    }
  }

  const doSubmit = (value: string) => run(value, onSubmit)

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
          {requireDocNo && (
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
                aria-required={true}
                aria-invalid={invalid}
                aria-describedby={invalid ? 'send-acc-error' : undefined}
                className="mono"
              />
            </div>
          )}
          {/* Loại chỉ-Skip không có ô số → nhắc rõ hành vi: không tick vẫn gửi Accounting. */}
          {!requireDocNo && (
            <p className="skiphint">{t('board.modals.sendAccounting.skipOnlyHint')}</p>
          )}
          {allowSkip && onSkip && (
            <label className={`skipbox${skip ? ' on' : ''}`}>
              <input
                type="checkbox"
                checked={skip}
                onChange={(e) => {
                  setSkip(e.target.checked)
                  if (error) setError(null)
                }}
              />
              <span className="skipbox-box" aria-hidden>
                <Check size={13} strokeWidth={3} />
              </span>
              <span className="skipbox-ttl">{t('board.modals.sendAccounting.skipLabel')}</span>
            </label>
          )}
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
          <button
            type="button"
            className={`btn ${skipping ? 'warnfill' : 'primary'}`}
            disabled={busy}
            onClick={submit}
          >
            {skipping
              ? t('board.modals.sendAccounting.skipSubmit')
              : t('board.modals.sendAccounting.submit')}
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
      {skipConfirming && (
        <ConfirmModal
          title={t('board.modals.sendAccounting.skipConfirmTitle')}
          message={t('board.modals.sendAccounting.skipConfirmMessage')}
          code={code}
          danger
          confirmLabel={t('board.modals.sendAccounting.skipConfirmSubmit')}
          onConfirm={() => onSkip && run(documentNo.trim(), onSkip)}
          onCancel={() => setSkipConfirming(false)}
        />
      )}
    </div>
  )
}
