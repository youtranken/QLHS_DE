import { useState } from 'react'
import { primaryLabel } from './primaryAction'
import type { LegalAction } from './api'
import { t } from '../../i18n'

export interface BulkActionBarProps {
  count: number
  actions: LegalAction[]
  busy?: boolean
  onApply: (action: LegalAction, alsoComplete?: boolean) => void
  onClear: () => void
}

/** Sticky bar shown when ≥1 card is selected: apply one of the actions legal for
 *  every selected card (FR-8), or clear. At DCC2's "Submitted to DCC2 (Hardcopy)"
 *  the confirm action carries a "Hoàn tất luôn" checkbox that chains complete after
 *  the bulk receipt — closing the whole batch in one click. */
export function BulkActionBar({ count, actions, busy = false, onApply, onClear }: BulkActionBarProps) {
  const [alsoComplete, setAlsoComplete] = useState(false)
  if (count === 0) return null
  const hasConfirm = actions.some((a) => a.event === 'confirmReceivedByDcc2')
  return (
    <div className="bulkbar" role="region" aria-label={t('board.bulk.selected', { n: count })}>
      <span className="bulkcount">{t('board.bulk.selected', { n: count })}</span>
      <div className="bulkacts">
        {actions.map((a) => (
          <button
            key={a.event}
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => onApply(a, a.event === 'confirmReceivedByDcc2' ? alsoComplete : undefined)}
          >
            {/* Bulk = confirm MANY, so name the confirm action for the batch context
                (both DCC2/DCC3) without changing the card's neutral "Kiểm tra bản
                cứng" label. */}
            {a.event === 'confirmReceivedByDcc2' || a.event === 'confirmReceivedByDcc3'
              ? t('board.primary.confirmHardcopy')
              : primaryLabel(a)}
          </button>
        ))}
        {hasConfirm && (
          <label className="bulkalso">
            <input type="checkbox" checked={alsoComplete} disabled={busy} onChange={(e) => setAlsoComplete(e.target.checked)} />
            {t('board.bulk.alsoComplete')}
          </label>
        )}
      </div>
      <button type="button" className="btn ghost" disabled={busy} onClick={onClear}>
        {t('board.bulk.clear')}
      </button>
    </div>
  )
}
