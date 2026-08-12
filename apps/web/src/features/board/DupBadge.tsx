import { openTicketDetail } from '../../shared/route'
import type { DupHint } from './api'
import { t } from '../../i18n'

export interface DupBadgeProps {
  hints: DupHint[]
}

/**
 * F12 — reception-gate duplicate warning. A compact badge: "⚠ N" whose label reads
 * "Nghi trùng hồ sơ {code}", and clicking opens the suspected ticket so DCC1 can
 * compare, then take this one in or Return it. A hint, never a block. (Was a rich
 * hover card — dropped because it overflowed the column; the code + one click is all
 * DCC1 needs, and the target ticket shows the full comparison.)
 */
export function DupBadge({ hints }: DupBadgeProps) {
  if (hints.length === 0) return null
  const strong = hints.some((h) => h.tier === 'strong')
  const first = hints[0]!
  const code = first.code ?? t('board.card.draft')
  const label =
    hints.length === 1
      ? t('board.dup.line', { code })
      : t('board.dup.lineMany', { code, n: hints.length - 1 })
  return (
    <button
      type="button"
      className={`duppill${strong ? ' strong' : ''}`}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        openTicketDetail(first.code ?? first.id)
      }}
    >
      ⚠ {hints.length}
    </button>
  )
}
