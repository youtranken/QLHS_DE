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

/** Người đẩy giỏ hàng chạy trên ray tới ga tiền-tuyến rồi đậu (màu theo tuyến qua
 *  --lc). Người side-view + giỏ Lucide đã canh để mép sau giỏ khớp tay người đẩy. */
function Loco() {
  return (
    <svg className="loco" viewBox="0 0 32 30" aria-hidden>
      <g className="lnf">
        <circle cx="8.5" cy="7" r="2.8" fill="none" />
        <path d="M8.5 9.8 L10.6 17.6" />
        <path d="M8.9 12.2 L16 14" />
        <path d="M10.6 17.6 L7.4 26.6 M10.6 17.6 L14.6 25" />
      </g>
      <g className="lnf" transform="translate(14.8,12.8) scale(0.585)">
        <circle cx="8" cy="21" r="1.6" />
        <circle cx="19" cy="21" r="1.6" />
        <path d="M2.05 2.05 H4 L6.66 14.47 A2 2 0 0 0 8.66 16.05 H18.44 A2 2 0 0 0 20.39 14.48 L22.04 7.05 H5.12" />
      </g>
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
