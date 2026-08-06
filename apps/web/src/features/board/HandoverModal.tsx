import { useState } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../shared/useFocusTrap'
import { useBackdropClose } from '../../shared/useBackdropClose'
import { ConfirmModal } from '../../shared/ConfirmModal'
import { DatePicker } from '../../shared/DatePicker'
import { toast } from '../../shared/toast'
import { t } from '../../i18n'

/** Today as YYYY-MM-DD for the date input default (local time). */
function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export interface HandoverModalProps {
  code: string
  onConfirm: (receivedAt: string) => Promise<void>
  /** When present, renders the opposing "missing paper" button (DCC2 handover).
   *  Omit for a date-only receipt (e.g. DCC1 "Nhận về từ ACC"). */
  onMissing?: () => Promise<void>
  onClose: () => void
  title?: string
  confirmLabel?: string
  dateLabel?: string
}

/**
 * Hardcopy receipt confirmation (UX-DR8, AD-10): a decisive "received" button that
 * records the date, optionally paired with an "missing paper" bounce. Focus is
 * trapped, ESC closes, and focus returns to the trigger on unmount.
 */
export function HandoverModal({
  code,
  onConfirm,
  onMissing,
  onClose,
  title = t('board.modals.handover.title'),
  confirmLabel = t('board.modals.handover.confirm'),
  dateLabel = t('board.modals.handover.dateLabel'),
}: HandoverModalProps) {
  const { ref, onKeyDown } = useFocusTrap<HTMLDivElement>(onClose)
  const [receivedAt, setReceivedAt] = useState(today)
  const [busy, setBusy] = useState(false)
  const [confirmingMissing, setConfirmingMissing] = useState(false)
  // Arm on backdrop mousedown so a drag that STARTS in the date field and ends on
  // the overlay doesn't discard the receipt (useBackdropClose); guard on busy.
  const backdrop = useBackdropClose(() => {
    if (!busy) onClose()
  })

  async function guard(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch {
      toast.err(t('board.toasts.actionFailed'))
    } finally {
      // Reset on success too — else a caller that keeps the modal mounted after a
      // successful confirm strands every button (incl. ✕) disabled.
      setBusy(false)
    }
  }

  return (
    <div role="presentation" className="overlay" onKeyDown={onKeyDown} {...backdrop}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="handover-title"
        className="modal sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt">
          <span className="ttl" id="handover-title">
            {title} · <span className="mono accent">{code}</span>
          </span>
          <button type="button" className="x" aria-label={t('board.modals.close')} disabled={busy} onClick={onClose}>
            <X size={15} aria-hidden />
          </button>
        </div>
        <div className="mb">
          <div className="field">
            <label id="handover-date-lbl">{dateLabel}</label>
            <DatePicker value={receivedAt} onChange={setReceivedAt} ariaLabel={dateLabel} max={today()} clearable={false} />
          </div>
        </div>
        <div className="mf">
          {onMissing && (
            <button
              type="button"
              className="btn warn"
              disabled={busy}
              onClick={() => setConfirmingMissing(true)}
            >
              {t('board.modals.handover.missingButton')}
            </button>
          )}
          <span className="sp" />
          <button type="button" className="btn ghost" disabled={busy} onClick={onClose}>
            {t('board.modals.close')}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void guard(() => onConfirm(receivedAt))}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
      {confirmingMissing && onMissing && (
        <ConfirmModal
          message={t('board.modals.handover.missingConfirm')}
          code={code}
          danger
          confirmLabel={t('board.modals.handover.missingConfirmBtn')}
          onConfirm={() => {
            setConfirmingMissing(false)
            return guard(onMissing)
          }}
          onCancel={() => setConfirmingMissing(false)}
        />
      )}
    </div>
  )
}
