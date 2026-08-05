import { t } from '../../i18n'
import type { ThroughputBucket } from './api'

function label(period: string, granularity: 'week' | 'month'): string {
  if (granularity === 'month') {
    const [y, m] = period.split('-')
    return `${m}/${y}`
  }
  const [, m, d] = period.split('-')
  return `${d}/${m}`
}

/** Round a raw tick step up to the nearest 1/2/5×10ⁿ so the y-axis reads in whole,
 *  human numbers (…5,10,15…) instead of arbitrary fractions. */
function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / mag
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag
}

const PLOT_L = 44
const PLOT_W_BASE = 504
const BASE_Y = 200
const TOP_Y = 20
const PLOT_H = BASE_Y - TOP_Y
const BAR_W = 16
const TICKS = 4
// Each period needs ~44px for its twin bars + label; below that they overlap, so
// the plot grows past the base width and the wrapper scrolls horizontally.
const GROUP_MIN = 44

/** Created vs cleared per period — twin bars sharing one scale so "are we keeping
 *  up?" reads at a glance. Pure presentation over the use-case's throughput series. */
export function ThroughputChart({
  data,
  granularity,
}: {
  data: ThroughputBucket[]
  granularity: 'week' | 'month'
}) {
  if (data.length === 0) return <p className="az-empty">{t('adminAnalytics.throughput.empty')}</p>

  const peak = Math.max(1, ...data.map((b) => Math.max(b.created, b.completed)))
  // Ticket counts are whole — never let a low-volume peak (1–2) yield a 0.5 step.
  const step = Math.max(1, niceStep(peak / TICKS))
  const axisTop = step * TICKS
  const yOf = (v: number) => BASE_Y - (v / axisTop) * PLOT_H

  const plotW = Math.max(PLOT_W_BASE, data.length * GROUP_MIN)
  const PLOT_R = PLOT_L + plotW
  const W = PLOT_R + 12
  const groupW = plotW / data.length
  const wide = W > 560

  return (
    <div className="az-chartwrap">
      <svg
        className="az-barchart"
        viewBox={`0 0 ${W} 236`}
        style={{ width: wide ? `${W}px` : '100%', maxWidth: wide ? 'none' : '100%' }}
        role="img"
        aria-label={t('adminAnalytics.throughput.chartAria')}
      >
        <g>
          {Array.from({ length: TICKS + 1 }, (_, k) => {
            const v = k * step
            const y = yOf(v)
            return (
              <g key={k}>
                <line className="grid-line" x1={PLOT_L} y1={y} x2={PLOT_R} y2={y} />
                <text className="axis-num" x={PLOT_L - 8} y={y + 4} textAnchor="end">{v}</text>
              </g>
            )
          })}
        </g>
        {data.map((b, i) => {
          const gx = PLOT_L + (i + 0.5) * groupW
          const inX = gx - BAR_W - 3
          const outX = gx + 3
          return (
            <g key={b.period}>
              <rect className="bar-in" x={inX} y={yOf(b.created)} width={BAR_W} height={BASE_Y - yOf(b.created)} rx={3}>
                <title>{t('adminAnalytics.throughput.createdTitle', { n: b.created })}</title>
              </rect>
              <rect className="bar-out" x={outX} y={yOf(b.completed)} width={BAR_W} height={BASE_Y - yOf(b.completed)} rx={3}>
                <title>{t('adminAnalytics.throughput.completedTitle', { n: b.completed })}</title>
              </rect>
              <text className="x-lbl" x={gx} y={222} textAnchor="middle">{label(b.period, granularity)}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
