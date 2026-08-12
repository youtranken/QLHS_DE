import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useBackdropClose } from './useBackdropClose'
import { t } from '../i18n'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export interface ConfirmModalProps {
  title?: string
  /** Plain string, or a node so a word can be emphasised (bold). */
  message: ReactNode
  /** Highlighted ticket code shown after the message. */
  code?: string
  /** Show a required reason textarea; the confirm button stays disabled until filled. */
  reason?: boolean
  /** Pre-filled reason text (still editable) — e.g. the duplicate F12 found. */
  reasonDefault?: string
  /** Solid-red confirm button for irreversible / destructive actions. */
  danger?: boolean
  confirmLabel?: string
  onConfirm: (reason?: string) => void | Promise<void>
  onCancel: () => void
}

/**
 * On-design replacement for window.confirm / window.prompt (UX-DR15): a single-
 * layer dialog that states the consequence, optionally collects a required reason,
 * and traps focus. Reversible actions never reach here — they run then offer Undo.
 */
export function ConfirmModal({
  // Default params re-evaluate per call, so a locale switch is picked up.
  title = t('common.confirm.title'),
  message,
  code,
  reason = false,
  reasonDefault = '',
  danger = false,
  confirmLabel = t('common.actions.confirm'),
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // Per-instance ids: this modal can nest inside another modal's overlay (see
  // onKeyDown note), so two are mounted at once — static ids would duplicate and
  // break aria-labelledby + label htmlFor for both.
  const titleId = useId()
  const reasonId = useId()
  const [text, setText] = useState(reasonDefault)
  const [busy, setBusy] = useState(false)
  const ready = !reason || text.trim().length > 0
  const backdrop = useBackdropClose(() => {
    if (!busy) onCancel()
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    return () => opener?.focus()
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    // When nested inside another modal's overlay, keep Esc/Tab from bubbling to
    // the parent's focus-trap — otherwise Esc closes BOTH dialogs (data loss).
    if (e.key === 'Escape' || e.key === 'Tab') e.stopPropagation()
    if (e.key === 'Escape') {
      onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (!nodes || nodes.length === 0) return
    const list = Array.from(nodes)
    const firstEl = list[0]
    const lastEl = list[list.length - 1]
    if (!firstEl || !lastEl) return
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault()
      lastEl.focus()
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault()
      firstEl.focus()
    }
  }

  async function confirm() {
    if (busy || !ready) return
    setBusy(true)
    try {
      await onConfirm(reason ? text.trim() : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="presentation"
      className="overlay"
      onKeyDown={onKeyDown}
      onMouseDown={backdrop.onMouseDown}
      onClick={(e) => {
        // Don't let a backdrop click bubble to a parent overlay's onClick (which
        // would also close the parent modal underneath). Close only on a true
        // backdrop press+release (useBackdropClose), never a drag out of a field.
        e.stopPropagation()
        backdrop.onClick(e)
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt">
          <span className="ttl" id={titleId}>
            {title}
          </span>
          <button type="button" className="x" aria-label={t('common.actions.close')} onClick={onCancel}>
            <X size={15} aria-hidden />
          </button>
        </div>
        <div className="mb">
          <p>
            {message}
            {code && <> <span className="mono accent">{code}</span></>}
          </p>
          {reason && (
            <div className="field">
              <label htmlFor={reasonId}>
                {t('common.confirm.reasonLabel')} <span className="req">*</span>
              </label>
              <textarea
                id={reasonId}
                value={text}
                placeholder={t('common.confirm.reasonPlaceholder')}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="mf">
          <span className="sp" />
          <button type="button" className="btn ghost" onClick={onCancel}>
            {t('common.actions.cancel')}
          </button>
          <button
            type="button"
            className={danger ? 'btn warnfill' : 'btn primary'}
            disabled={busy || !ready}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
