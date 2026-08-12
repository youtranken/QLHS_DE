import { PRIORITY } from '@qlhs/contracts'
import { t } from '../../i18n'
import { Select } from '../../shared/Select'
import type { BoardFilter } from './boardFilter'

const FLOW_OPTS = ['All', 'Contract', 'Payment', 'General'] as const
// Priority filter is a compact dropdown: "Tất cả" (default) → Gấp / Thường.
// "Khẩn" (Urgent) dropped from the picker.
const PRIO_OPTS = [
  { v: 'All', k: 'board.filter.all' },
  { v: PRIORITY.Rush, k: 'board.card.prioRush' },
  { v: PRIORITY.Normal, k: 'board.card.prioNormal' },
] as const

/**
 * Board facets shown inline on the header row: flow chips (DCC1 only) + a compact
 * priority dropdown. Saved views were dropped as unused — one clean row of controls.
 */
export function BoardFilterBar({
  canManage,
  filter,
  onFlow,
  onPriority,
}: {
  canManage: boolean
  filter: BoardFilter
  onFlow: (v: string) => void
  onPriority: (v: string) => void
}) {
  return (
    <div className="boardfacets">
      {canManage && (
        <div className="fgrp" role="group" aria-label={t('board.filter.flowLabel')}>
          {FLOW_OPTS.map((fl) => (
            <button
              key={fl}
              type="button"
              aria-pressed={filter.flow === fl}
              className={`fchip${filter.flow === fl ? ' on' : ''}`}
              onClick={() => onFlow(fl)}
            >
              {fl === 'All' ? t('board.filter.all') : <span lang="en">{fl}</span>}
            </button>
          ))}
        </div>
      )}
      <Select
        value={filter.priority}
        onChange={onPriority}
        options={PRIO_OPTS.map((p) => ({ value: p.v, label: t(p.k) }))}
        ariaLabel={t('board.filter.priorityLabel')}
        className="priosel"
      />
    </div>
  )
}
