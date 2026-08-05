import { useRef } from 'react'
import { MoreVertical, Pause, TriangleAlert } from 'lucide-react'
import { groupAmount } from '../../shared/format'
import { openTicketDetail } from '../../shared/route'
import { DupBadge } from './DupBadge'
import { slaActionsFor } from './slaPauseActions'
import { splitActions, primaryLabel } from './primaryAction'
import type { BoardCard, LegalAction } from './api'
import { t } from '../../i18n'

export interface BoardCardViewProps {
  card: BoardCard
  onAction: (card: BoardCard, action: LegalAction) => void
  onSeize: (id: string) => void
  /** A POST for this card is in flight — disable the launcher to block double-submit. */
  busy?: boolean
  /** FR-8 bulk-select (Andy column, DCC1): show a checkbox. */
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
}

const FLOW_CLS: Record<string, string> = { Contract: 'flc', Payment: 'flp', General: 'flg' }
const PRIO_CLASS: Record<string, string> = { urgent: 'pill-prio urgent', rush: 'pill-prio rush' }
const prioLabel = (p: string): string =>
  p === 'urgent' ? t('board.card.prioUrgent') : p === 'rush' ? t('board.card.prioRush') : p

/** One dense ticket card with its keyboard-accessible ⋯ action menu (AD-17).
 *  Left rule is flow-coloured; over-SLA repaints it red. A soft-lock shows Seize. */
export function BoardCardView({
  card: c, onAction, onSeize, busy = false,
  selectable = false, selected = false, onToggleSelect,
}: BoardCardViewProps) {
  // The server already subtracts paused time, so any ▲ left here is a breach
  // that happened BEFORE the clock stopped — show it alongside ⏸ rather than
  // letting a pause erase it, which would make pausing the way to clear red.
  const over = c.overdueDays > 0
  const cls = `tcard ${FLOW_CLS[c.flow] ?? ''}${over && !c.paused ? ' over' : ''}${c.paused ? ' paused' : ''}`.trim()
  // Bước tiến an toàn → nút chính; Trả lại/Mở lại/đẩy ngược/SLA → ⋯ (guard giữ nguyên).
  const { primary, menu } = splitActions([...c.actions, ...slaActionsFor(c)])
  // Collapse the ⋯ menu when an item is chosen so it isn't left hanging open
  // behind the modal/confirm the action pops.
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const closeMenu = () => detailsRef.current?.removeAttribute('open')
  return (
    <article className={`${cls}${selected ? ' picked' : ''}`}>
      <div className="r1">
        {selectable && (
          <input
            type="checkbox"
            className="bulksel"
            checked={selected}
            disabled={busy}
            onChange={() => onToggleSelect?.(c.id)}
            aria-label={t('board.card.selectAria', { code: c.code ?? t('board.card.draft') })}
          />
        )}
        <button
          type="button"
          className="code"
          onClick={() => openTicketDetail(c.id)}
          title={t('board.card.openDetail')}
        >
          {c.code ?? t('board.card.draft')}
        </button>
        {over && (
          <span
            className={c.paused ? 'slapill held' : 'slapill'}
            aria-label={
              c.paused
                ? t('board.card.overdueBeforePause', { n: c.overdueDays })
                : t('board.card.overdue', { n: c.overdueDays })
            }
            title={c.paused ? t('board.card.lateBeforePauseTitle') : undefined}
          >
            <TriangleAlert size={11} aria-hidden />
            {t('board.card.overduePill', { n: c.overdueDays })}
          </span>
        )}
        {c.paused && (
          <span className="pausepill" title={t('board.card.pausedTitle')}>
            <Pause size={11} aria-hidden />
            {t('board.card.pausedPill')}
          </span>
        )}
        {PRIO_CLASS[c.priority] && (
          <span className={PRIO_CLASS[c.priority]}>{prioLabel(c.priority)}</span>
        )}
        <DupBadge hints={c.dupOf ?? []} />
        {(menu.length > 0 || c.lockedBy) && (
        <details ref={detailsRef}>
          <summary className="dots" aria-label={t('board.menu.aria')} aria-busy={busy}>
            <MoreVertical size={16} aria-hidden />
          </summary>
          <div className="cardmenu">
            {c.lockedBy ? (
              <div className="lock">
                {t('board.menu.lockedBy', { user: c.lockedBy })}{' '}
                <button type="button" disabled={busy} onClick={() => { closeMenu(); onSeize(c.id) }}>
                  {t('board.menu.seize')}
                </button>
              </div>
            ) : (
              menu.map((a, i) => (
                <span key={a.event}>
                  {i > 0 && a.reasonRequired && <div className="sep" />}
                  <button
                    type="button"
                    disabled={busy}
                    className={a.reasonRequired ? 'danger' : undefined}
                    onClick={() => { closeMenu(); onAction(c, a) }}
                  >
                    {a.label}
                  </button>
                </span>
              ))
            )}
          </div>
        </details>
        )}
      </div>
      <div className="who">{c.contractor ?? '—'}</div>
      {(c.amount || (primary.length > 0 && !c.lockedBy)) && (
        <div className="actrow">
          {c.amount && <span className="amt">{groupAmount(c.amount)}</span>}
          {primary.length > 0 && !c.lockedBy && (
            <div className="actbtns">
              {primary.map((a, i) => (
                <button
                  key={a.event}
                  type="button"
                  disabled={busy}
                  className={i === 0 ? 'pact' : 'pact sec'}
                  onClick={() => { closeMenu(); onAction(c, a) }}
                >
                  {primaryLabel(a)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
