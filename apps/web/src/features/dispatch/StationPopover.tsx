import type { CSSProperties } from 'react'
import { TriangleAlert } from 'lucide-react'
import { applyVp, t } from '../../i18n'
import type { StationTicket } from './api'

/** Popover preview khi hover ga: ≤3 hồ sơ + "n nữa". Vị trí do LineMap tính từ
 *  rect của node (fixed, pointer-events:none nên không chắn chuột). */
export function StationPopover({
  status,
  tickets,
  anchor,
}: {
  status: string
  tickets: StationTicket[]
  anchor: DOMRect
}) {
  const W = 256
  const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - W / 2, window.innerWidth - W - 8))
  const top = anchor.bottom + 10
  const shown = tickets.slice(0, 3)

  return (
    <div className="stnpop" role="tooltip" style={{ left, top } as CSSProperties}>
      <div className="ph">
        <span className="pt" lang="en">
          {applyVp(status)}
        </span>
        <span className="pn">{t('dispatch.ticketCount', { n: tickets.length })}</span>
      </div>
      {tickets.length === 0 && <div className="more">{t('dispatch.stationEmpty')}</div>}
      {shown.map((tk) => (
        <div className="row" key={tk.id}>
          <span className="c">{tk.code ?? tk.id.slice(0, 8)}</span>
          <span className="w">{tk.contractor ?? '—'}</span>
          {tk.overdueDays > 0 && (
            <span className="d ov">
              <TriangleAlert size={10} aria-hidden />
              {t('dispatch.overdueDaysBadge', { n: tk.overdueDays })}
            </span>
          )}
        </div>
      ))}
      {tickets.length > 3 && <div className="more">{t('dispatch.moreTickets', { n: tickets.length - 3 })}</div>}
      <div className="hint">{t('dispatch.openHint')}</div>
    </div>
  )
}
