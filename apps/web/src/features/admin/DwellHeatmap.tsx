import type { DwellRow } from './api'
import { applyVp, t } from '../../i18n'
import { statusVi } from '../tickets/statusLabel'
import { flowVi } from './flowLabel'

const SCALE = [12, 30, 48, 60, 72]

/** Station × flow dwell heatmap: the hotter a cell, the longer files sit there
 *  before moving on. Intensity is scaled to the single worst cell so the
 *  bottleneck stands out; the legend anchors the scale to that worst value. */
export function DwellHeatmap({ rows, flows }: { rows: DwellRow[]; flows: string[] }) {
  if (rows.length === 0) return <p className="az-empty">{t('adminAnalytics.dwell.empty')}</p>
  const max = Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => c.avgDays)))

  return (
    <>
      <div className="az-heatwrap">
        <table className="az-heat">
          <thead>
            <tr>
              <th scope="col" className="az-hcorner">{t('adminAnalytics.dwell.station')}</th>
              {flows.map((f) => (
                <th key={f} scope="col">{flowVi(f)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.status}>
                <th scope="row" className="az-hrow" lang="en" title={statusVi(r.status)}>{applyVp(r.status)}</th>
                {r.cells.map((c) => {
                  const tint = c.count === 0 ? 0 : tintPct(c.avgDays, max)
                  return (
                    <td
                      key={c.flow}
                      // ≥42% amber is light enough that near-white --ink drops below
                      // AA; `hot` pins a fixed dark ink so the number stays legible.
                      className={`az-hcell${c.count === 0 ? ' empty' : ''}${tint >= 42 ? ' hot' : ''}`}
                      style={tint > 0 ? { background: `color-mix(in srgb, var(--rush) ${tint}%, transparent)` } : undefined}
                      title={t('adminAnalytics.dwell.cellTitle', { status: statusVi(r.status), flow: flowVi(c.flow), days: c.avgDays, count: c.count })}
                    >
                      {c.count === 0 ? '·' : c.avgDays}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="az-heatlegend">
        <span>{t('adminAnalytics.dwell.legendLow')}</span>
        <span className="az-heatscale" aria-hidden>
          {SCALE.map((a) => (
            <span key={a} style={{ background: `color-mix(in srgb, var(--rush) ${a}%, transparent)` }} />
          ))}
        </span>
        <span>{t('adminAnalytics.dwell.legendHigh', { n: max })}</span>
      </div>
    </>
  )
}

/** Amber tint % as dwell approaches the worst cell (12%–72%); 0 = no tint. */
function tintPct(avgDays: number, max: number): number {
  if (avgDays <= 0) return 0
  return Math.round((avgDays / max) * 60) + 12
}
