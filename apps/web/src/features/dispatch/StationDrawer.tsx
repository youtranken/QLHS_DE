import type { CSSProperties } from 'react'
import { applyVp, t } from '../../i18n'
import type { StationTicket } from './api'
import { openTicketDetail } from '../../shared/route'
import { useFocusTrap } from '../../shared/useFocusTrap'

function flc(flow: string): string {
  const f = flow.toLowerCase()
  if (f.includes('payment')) return 'flp'
  if (f.includes('contract') || f.includes('budget')) return 'flc'
  return 'flg'
}

/** Drawer chi tiết ga (click node): 4 thống kê + thanh SLA + danh sách hồ sơ.
 *  Dữ liệu suy từ getStationTickets (overdueDays) — không cần API mới. */
export function StationDrawer({
  status,
  tickets,
  onClose,
}: {
  status: string
  tickets: StationTicket[]
  onClose: () => void
}) {
  const { ref, onKeyDown } = useFocusTrap<HTMLElement>(onClose)
  const total = tickets.length
  const over = tickets.filter((t) => t.overdueDays > 0).length
  const onTime = total - over
  const maxOver = tickets.reduce((m, t) => Math.max(m, t.overdueDays), 0)
  const ratio = total ? Math.round((onTime / total) * 100) : 100

  return (
    <aside
      ref={ref}
      className="stndrawer open"
      role="dialog"
      aria-modal="true"
      aria-label={t('dispatch.stationLabel', { status })}
      onKeyDown={onKeyDown}
    >
      <div className="dh">
        <div className="r1">
          <span className="t" lang="en">
            {applyVp(status)}
          </span>
          <button type="button" className="btn ghost icon" onClick={onClose} aria-label={t('dispatch.close')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="s">{t('dispatch.atStationCount', { n: total })}</div>
      </div>

      <div className="dstats">
        <div className="dstat">
          <div className="l">{t('dispatch.statAtStation')}</div>
          <div className="v">{total}</div>
        </div>
        <div className={over ? 'dstat hot' : 'dstat'}>
          <div className="l">{t('dispatch.statOverSla')}</div>
          <div className="v">{over}</div>
        </div>
        <div className="dstat">
          <div className="l">{t('dispatch.statOnTime')}</div>
          <div className="v">{onTime}</div>
        </div>
        <div className={maxOver > 0 ? 'dstat hot' : 'dstat'}>
          <div className="l">{t('dispatch.statMaxLate')}</div>
          <div className="v">{t('dispatch.daysShort', { n: maxOver })}</div>
        </div>
      </div>

      <div className="dsla">
        <div className={over ? 'slameter over' : 'slameter'}>
          <div className="bar">
            <i style={{ width: `${ratio}%` } as CSSProperties} />
          </div>
          <div className="cap">
            <span>{t('dispatch.onTimePercent', { n: ratio })}</span>
            <span>{t('dispatch.overSlaCount', { n: over })}</span>
          </div>
        </div>
      </div>

      <div className="db">
        <div className="cap2">{t('dispatch.listCaption')}</div>
        {total === 0 && <div className="pi">{t('dispatch.stationEmpty')}</div>}
        {tickets.map((tk) => (
          <button
            type="button"
            key={tk.id}
            className={`pi ${flc(tk.flow)}${tk.overdueDays > 0 ? ' ov' : ''}`}
            onClick={() => openTicketDetail(tk.id)}
          >
            <span className="r1">
              <span className="pc">{tk.code ?? tk.id.slice(0, 8)}</span>
              <span className={tk.overdueDays > 0 ? 'pd ovt' : 'pd'}>
                {tk.overdueDays > 0 ? t('dispatch.overdueDaysLabel', { n: tk.overdueDays }) : t('dispatch.onTime')}
              </span>
            </span>
            <span className="pw">{tk.contractor ?? '—'}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
