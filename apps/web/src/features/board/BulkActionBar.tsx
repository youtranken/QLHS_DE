import { primaryLabel } from './primaryAction'
import type { LegalAction } from './api'
import { t } from '../../i18n'

export interface BulkActionBarProps {
  count: number
  actions: LegalAction[]
  busy?: boolean
  onApply: (action: LegalAction) => void
  onClear: () => void
}

/** FR-8 — sticky bar shown when ≥1 card in the Andy column is selected: apply one
 *  of the actions legal for every selected card, or clear the selection. */
export function BulkActionBar({ count, actions, busy = false, onApply, onClear }: BulkActionBarProps) {
  if (count === 0) return null
  return (
    <div className="bulkbar" role="region" aria-label={t('board.bulk.selected', { n: count })}>
      <span className="bulkcount">{t('board.bulk.selected', { n: count })}</span>
      <div className="bulkacts">
        {actions.map((a) => (
          <button key={a.event} type="button" className="btn primary" disabled={busy} onClick={() => onApply(a)}>
            {primaryLabel(a)}
          </button>
        ))}
      </div>
      <button type="button" className="btn ghost" disabled={busy} onClick={onClear}>
        {t('board.bulk.clear')}
      </button>
    </div>
  )
}
