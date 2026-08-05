import type { CSSProperties } from 'react'
import { TriangleAlert } from 'lucide-react'
import { t } from '../../i18n'
import type { FlowLine } from './api'
import { StationNode, TERMINAL } from './StationNode'

export function flowMeta(flow: string): { cls: string; letter: string; badge: string } {
  const f = flow.toLowerCase()
  if (f.includes('payment')) return { cls: 'fl-payment', letter: 'C', badge: 'c' }
  if (f.includes('contract') || f.includes('budget')) return { cls: 'fl-contract', letter: 'B', badge: 'b' }
  return { cls: 'fl-general', letter: 'A', badge: 'a' }
}

/** Đầu máy chạy trên ray tới ga tiền-tuyến rồi đậu (màu theo tuyến qua --lc). */
function Loco() {
  return (
    <svg className="loco" viewBox="0 0 36 20" aria-hidden>
      <g className="wh">
        <circle cx="11" cy="16" r="2.3" />
        <circle cx="25" cy="16" r="2.3" />
      </g>
      <rect className="cab" x="8" y="2" width="2.6" height="3.6" rx=".8" />
      <path className="cab" d="M4 14 V8 Q4 5 7 5 H22 L31 10 V14 Z" />
      <rect className="win" x="7.5" y="7.2" width="8.5" height="3.4" rx="1" />
      <path className="win" d="M19.5 7 H23 L27.5 10 H19.5 Z" />
      <circle className="lamp" cx="30" cy="12" r="1.5" />
    </svg>
  )
}

/** Một tuyến: nhãn (A/B/C xếp trên tên) + ĐƯỜNG RAY LIỀN một mạch. Lớp "đã đi qua"
 *  (.lit) mọc dần tới ga tiền-tuyến (ga xa nhất còn hồ sơ) qua --p; đầu máy chạy tới
 *  đó rồi đậu. Node đặt tuyệt đối theo --x = i/(n-1) — không đoạn ray rời. */
export function MetroLine({
  line,
  onOpen,
  onHover,
  onLeave,
}: {
  line: FlowLine
  onOpen: (status: string, flow: string) => void
  onHover: (status: string, flow: string, el: HTMLElement) => void
  onLeave: () => void
}) {
  const m = flowMeta(line.flow)
  const stations = line.stations
  const denom = Math.max(stations.length - 1, 1)
  // Tiền-tuyến = ga XA NHẤT còn hồ sơ nhưng CHƯA phải ga cuối (tàu dừng ở đó).
  const lastActive = stations.reduce((acc, s, i) => (s.count > 0 && !TERMINAL.test(s.status) ? i : acc), -1)
  const p = lastActive > 0 ? lastActive / denom : 0
  // Loại ga cuối khỏi tổng quá-hạn của line — khớp header (overTotal) và cờ node.
  const overdue = stations.reduce(
    (sum, s) => sum + (s.overSla && !TERMINAL.test(s.status) ? s.overdueCount : 0),
    0,
  )

  return (
    <div className="mline">
      <div className="lbl">
        <span className={`lbadge ${m.badge}`} aria-hidden>
          {m.letter}
        </span>
        <span className="t">
          <span className="nm" lang="en">
            {line.flow}
          </span>
          <span className="ct">
            {t('dispatch.ticketCount', { n: line.total })}
            {overdue > 0 && (
              <span className="ov">
                <TriangleAlert size={11} aria-hidden />
                {t('dispatch.lineOverdue', { n: overdue })}
              </span>
            )}
          </span>
        </span>
      </div>
      <div className={`track ${m.cls}`} style={{ '--p': p } as CSSProperties}>
        <span className="rline" aria-hidden>
          <span className="lit" />
        </span>
        {lastActive >= 0 && (
          <span className="train" aria-hidden>
            <Loco />
          </span>
        )}
        {stations.map((s, i) => (
          <StationNode
            key={s.status}
            s={s}
            x={i / denom}
            front={i === lastActive}
            onOpen={(status) => onOpen(status, line.flow)}
            onHover={(status, el) => onHover(status, line.flow, el)}
            onLeave={onLeave}
          />
        ))}
      </div>
    </div>
  )
}
