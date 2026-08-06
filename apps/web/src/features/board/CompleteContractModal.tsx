import { useState } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../shared/useFocusTrap'
import { useBackdropClose } from '../../shared/useBackdropClose'
import { ConfirmModal } from '../../shared/ConfirmModal'
import { t } from '../../i18n'

export interface CompleteContractModalProps {
  code: string
  onSubmit: (scanPath: string) => Promise<void>
  onClose: () => void
}

/**
 * DCC2 closes a Contract: enters the shared-drive scan path and confirms (FR-12).
 * "Hoàn tất" is irreversible (AD-19) — it asks for a one-line consequence before
 * submitting. A path string only; no file upload (AD-7). Focus-trap + ESC.
 */
export function CompleteContractModal({ code, onSubmit, onClose }: CompleteContractModalProps) {
  const { ref, onKeyDown } = useFocusTrap<HTMLDivElement>(onClose)
  const [scanPath, setScanPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // Don't discard the typed scan path on a drag-select that ends on the backdrop.
  const backdrop = useBackdropClose(() => {
    if (!busy) onClose()
  })

  function submit() {
    if (busy) return
    const value = scanPath.trim()
    if (!value) {
      setError(t('board.modals.complete.pathRequired'))
      return
    }
    setError(null)
    setConfirming(true) // irreversible (AD-19) → confirm consequence before posting
  }

  async function doSubmit() {
    setConfirming(false)
    setBusy(true)
    setError(null)
    try {
      await onSubmit(scanPath.trim())
    } catch {
      setError(t('board.modals.complete.failError'))
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
        aria-labelledby="complete-title"
        className="modal sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt">
          <span className="ttl" id="complete-title">
            {t('board.modals.complete.title')} · <span className="mono accent">{code}</span>
          </span>
          <button type="button" className="x" aria-label={t('board.modals.close')} disabled={busy} onClick={onClose}>
            <X size={15} aria-hidden />
          </button>
        </div>
        <div className="mb">
          <div className="field">
            <label htmlFor="complete-path">
              {t('board.modals.complete.pathLabel')} <span className="req">*</span>
            </label>
            <input
              id="complete-path"
              value={scanPath}
              onChange={(e) => {
                setScanPath(e.target.value)
                if (error) setError(null)
              }}
              placeholder="\\share\scans\CT-2026-0001.pdf"
              aria-required="true"
              aria-invalid={invalid}
              aria-describedby={invalid ? 'complete-error' : undefined}
              className="mono"
            />
          </div>
          {invalid && (
            <p id="complete-error" role="alert" className="err">
              {error}
            </p>
          )}
        </div>
        <div className="mf">
          <button type="button" className="btn ghost" disabled={busy} onClick={onClose}>
            {t('board.modals.cancel')}
          </button>
          <span className="sp" />
          <button type="button" className="btn primary" disabled={busy} onClick={submit}>
            {t('board.modals.complete.submit')}
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmModal
          message={t('board.consequence.completed')}
          code={code}
          danger
          confirmLabel={t('board.modals.complete.confirmBtn')}
          onConfirm={doSubmit}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
