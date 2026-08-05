import { groupAmount } from '../../shared/format'
import { openTicketDetail } from '../../shared/route'
import type { DupHint } from './api'
import { applyVp, t } from '../../i18n'

export interface DupBadgeProps {
  hints: DupHint[]
}

const tierLabel = (tier: string): string =>
  tier === 'strong' ? t('board.dup.tierStrong') : tier === 'medium' ? t('board.dup.tierMedium') : tier

/** F12 — reception-gate duplicate warning. A hint, never a block: DCC1 opens the
 *  suspected ticket to compare, then either takes this one in or Returns it. */
export function DupBadge({ hints }: DupBadgeProps) {
  if (hints.length === 0) return null
  const strong = hints.some((h) => h.tier === 'strong')
  return (
    <span className={`dupwrap${strong ? ' strong' : ''}`}>
      <button
        type="button"
        className="duppill"
        aria-label={t('board.dup.badgeAria', { n: hints.length })}
      >
        ⚠ {hints.length}
      </button>
      <div className="duppop" role="note">
        <div className="duphead">{t('board.dup.head', { n: hints.length })}</div>
        {hints.map((h) => (
          <div key={h.id} className={`dupitem ${h.tier}`}>
            <div className="r1">
              <button type="button" className="code" onClick={() => openTicketDetail(h.code ?? h.id)}>
                {h.code ?? t('board.card.draft')}
              </button>
              <span className="st" lang="en">{applyVp(h.status)}</span>
            </div>
            <div className="why">{tierLabel(h.tier)}</div>
            <div className="meta">
              {h.contractor ?? '—'}
              {h.amount ? ` · ${groupAmount(h.amount, h.currency ?? 'VND')}` : ''}
              {` · ${t('common.time.daysAgo', { n: h.ageDays })}`}
            </div>
          </div>
        ))}
        <div className="duphint">{t('board.dup.hint')}</div>
      </div>
    </span>
  )
}
