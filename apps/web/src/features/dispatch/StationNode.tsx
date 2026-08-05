import type { CSSProperties } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import { applyVp, t } from '../../i18n'
import type { StationNode as SN } from './api'
import { statusVi } from '../tickets/statusLabel'

/** Ga cuối/đã đóng (khớp TERMINAL_STATUSES chuẩn: Completed · Sent to Accounting ·
 *  Cancelled). Dùng chung cho StationNode + MetroLine — một nguồn duy nhất. */
export const TERMINAL = /done|completed|sent|closed|cancelled/i

/** Tên ga ngắn cho node (bỏ tiền tố dài, giữ tên ga). applyVp thay tên VP hiển
 *  thị (mặc định "Andy") — một nguồn cho mọi nhãn metro. */
export function shortStation(status: string): string {
  return applyVp(
    status
      .replace(/^Submitted to /i, '')
      .replace(/^Received by /i, '')
      .replace(/^Received from /i, ''),
  )
}

/** Số vòng sóng lan theo tải (nhiều hồ sơ → nhiều vòng). */
function ringCount(count: number): number {
  return count >= 4 ? 3 : count >= 2 ? 2 : 1
}

/** Một ga NEON đặt tuyệt đối theo --x. Node phát sáng theo tải (--n), vạch | nối
 *  mép dưới node xuống ray, nhãn dưới ray, cờ ▲ khi quá SLA, ring khi là tiền-tuyến. */
export function StationNode({
  s,
  x,
  front,
  onOpen,
  onHover,
  onLeave,
}: {
  s: SN
  x: number
  front: boolean
  onOpen: (status: string) => void
  onHover: (status: string, el: HTMLElement) => void
  onLeave: () => void
}) {
  const terminal = TERMINAL.test(s.status)
  const empty = !terminal && s.count === 0
  const active = !terminal && !empty
  // Ga cuối không bao giờ hiển thị trạng thái quá-SLA (xanh ✓ mâu thuẫn đỏ-đập).
  const over = s.overSla && !terminal
  const glow = Math.min(Math.max(s.count, 1), 5)
  const cls = [
    'stn',
    over ? 'over' : '',
    empty ? 'empty' : '',
    terminal ? 'done' : '',
    front && active ? 'front' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const content = terminal ? <Check size={16} aria-hidden /> : s.count > 0 ? s.count : ''

  return (
    <button
      type="button"
      className={cls}
      style={{ '--n': glow, '--x': x } as CSSProperties}
      onClick={() => onOpen(s.status)}
      onMouseEnter={(e) => onHover(s.status, e.currentTarget)}
      onMouseLeave={onLeave}
      onFocus={(e) => onHover(s.status, e.currentTarget)}
      onBlur={onLeave}
      title={statusVi(s.status)}
      aria-label={
        s.overSla
          ? t('dispatch.stationAriaOverdue', { status: s.status, count: s.count, overdue: s.overdueCount })
          : t('dispatch.stationAria', { status: s.status, count: s.count })
      }
    >
      <span className="tick" aria-hidden />
      {over && (
        <span className="flag" aria-hidden>
          <TriangleAlert size={10} />
          {s.overdueCount}
        </span>
      )}
      {active && (
        <span className="halo" aria-hidden>
          {Array.from({ length: ringCount(s.count) }, (_, i) => (
            <b key={i} />
          ))}
        </span>
      )}
      <span className="nd">{content}</span>
      <span className="cap">
        <span className="cn" lang="en">
          {shortStation(s.status)}
        </span>
        {active && <span className="cs">{t('dispatch.ticketCount', { n: s.count })}</span>}
      </span>
    </button>
  )
}
