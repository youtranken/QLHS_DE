import type { DwellRow } from './api'
import { t } from '../../i18n'
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
                <th scope="row" className="az-hrow" lang="en" title={statusVi(r.status)}>{r.status}</th>
                {r.cells.map((c) => (
                  <td
                    key={c.flow}
                    className={c.count === 0 ? 'az-hcell empty' : 'az-hcell'}
                    style={{ background: cellTint(c.avgDays, max) }}
                    title={t('adminAnalytics.dwell.cellTitle', { status: statusVi(r.status), flow: flowVi(c.flow), days: c.avgDays, count: c.count })}
                  >
                    {c.count === 0 ? '·' : c.avgDays}
                  </td>
                ))}
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

/** Transparent → --rush (amber) as dwell approaches the worst cell (12%–72% tint). */
function cellTint(avgDays: number, max: number): string {
  if (avgDays <= 0) return 'transparent'
  const pct = Math.round((avgDays / max) * 60) + 12
  return `color-mix(in srgb, var(--rush) ${pct}%, transparent)`
}
