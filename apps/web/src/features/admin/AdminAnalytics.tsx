import { useEffect, useState } from 'react'
import { CircleCheck, Download } from 'lucide-react'
import { t } from '../../i18n'
import { StateNotice } from '../../shared/StateNotice'
import { openTicketDetail } from '../../shared/route'
import { statusVi } from '../tickets/statusLabel'
import { getAnalytics, analyticsExportUrl, type AnalyticsData } from './api'
import { ThroughputChart } from './ThroughputChart'
import { DwellHeatmap } from './DwellHeatmap'
import { flowVi } from './flowLabel'

/** Per-flow meter tint: General→a (teal), Contract→b (blue), Payment→c (violet). */
const METER_CLASS: Record<string, string> = { General: 'a', Contract: 'b', Payment: 'c' }

/** 2.4 — trang analytics quản lý. Mọi số DERIVE ở read từ `ticket_event` (AD-6,
 *  không bảng mới): throughput, tỷ lệ Return, heatmap dwell theo ga, top hồ sơ
 *  trễ. Xuất CSV (UTF-8, mở thẳng Excel) cho kỳ tuỳ chọn. Chỉ Admin. */
export function AdminAnalytics() {
  const [granularity, setGranularity] = useState<'week' | 'month'>('month')
  const [d, setD] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    setD(null)
    setError(false)
    getAnalytics(granularity)
      .then((data) => alive && setD(data))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [granularity, nonce])

  // Return-rate bars scale to the worst flow so small deltas stay legible.
  const maxRate = d ? Math.max(0, ...d.returns.map((r) => r.ratePct)) : 0

  return (
    <section aria-label={t('adminAnalytics.ariaLabel')}>
      <h1 className="sr-only">{t('adminAnalytics.title')}</h1>
      <div className="pagehead" style={{ marginTop: 0, justifyContent: 'flex-end' }}>
        <a className="btn secondary" href={analyticsExportUrl()} download aria-label={t('adminAnalytics.exportAria')}>
          <Download size={16} aria-hidden />
          {t('adminAnalytics.exportCsv')}
        </a>
      </div>

      {error && <StateNotice kind="error" text={t('adminAnalytics.loadError')} onRetry={() => setNonce((n) => n + 1)} />}
      {!error && !d && <StateNotice kind="loading" text={t('adminAnalytics.loading')} />}

      {d && (
        <div className="az-grid">
          <section className="card az-panel" aria-label={t('adminAnalytics.throughput.aria')}>
            <div className="az-phead">
              <h2 className="az-ptitle">{t('adminAnalytics.throughput.title')}</h2>
              <div className="segmented" role="group" aria-label={t('adminAnalytics.throughput.granularityAria')}>
                <button type="button" className={granularity === 'week' ? 'seg active' : 'seg'} onClick={() => setGranularity('week')}>
                  {t('adminAnalytics.throughput.week')}
                </button>
                <button type="button" className={granularity === 'month' ? 'seg active' : 'seg'} onClick={() => setGranularity('month')}>
                  {t('adminAnalytics.throughput.month')}
                </button>
              </div>
            </div>
            <div className="az-legend">
              <span><i className="az-sw in" /> {t('adminAnalytics.throughput.legendIn')}</span>
              <span><i className="az-sw out" /> {t('adminAnalytics.throughput.legendOut')}</span>
            </div>
            <ThroughputChart data={d.throughput} granularity={d.granularity} />
          </section>

          <section className="card az-panel" aria-label={t('adminAnalytics.returns.title')}>
            <div className="az-phead">
              <h2 className="az-ptitle">{t('adminAnalytics.returns.title')}</h2>
              <span className="az-pnote">{t('adminAnalytics.returns.note')}</span>
            </div>
            <div className="az-retlist">
              {d.returns.map((r) => (
                <div className="az-rrow" key={r.flow}>
                  <span className="az-rflow">{flowVi(r.flow)}</span>
                  <span className={`meter ${METER_CLASS[r.flow] ?? 'a'}`}>
                    <span style={{ width: `${maxRate > 0 ? Math.round((r.ratePct / maxRate) * 100) : 0}%` }} />
                  </span>
                  <span className="az-rval">
                    <b>{r.ratePct}%</b> <em>{r.returns}/{r.tickets}</em>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card az-panel az-wide" aria-label={t('adminAnalytics.dwell.aria')}>
            <div className="az-phead">
              <h2 className="az-ptitle">{t('adminAnalytics.dwell.title')}</h2>
              <span className="az-pnote">{t('adminAnalytics.dwell.note')}</span>
            </div>
            <DwellHeatmap rows={d.dwell} flows={d.flows} />
          </section>

          <section className="card az-panel az-wide" aria-label={t('adminAnalytics.topOverdue.aria')}>
            <div className="az-phead">
              <h2 className="az-ptitle">{t('adminAnalytics.topOverdue.title')}</h2>
              {d.topOverdue.length > 0 && (
                <span className="az-pnote">{t('adminAnalytics.topOverdue.count', { n: d.topOverdue.length })}</span>
              )}
            </div>
            {d.topOverdue.length === 0 ? (
              <div className="empty">
                <div className="empty-ic"><CircleCheck size={26} aria-hidden /></div>
                <div className="empty-title">{t('adminAnalytics.topOverdue.emptyTitle')}</div>
                <div className="empty-help">{t('adminAnalytics.topOverdue.emptyHelp')}</div>
              </div>
            ) : (
              <div className="az-delaylist">
                {d.topOverdue.map((row) => (
                  <button
                    type="button"
                    className="az-delayrow"
                    key={row.id}
                    onClick={() => openTicketDetail(row.code ?? row.id)}
                  >
                    <span className="az-dcode mono">{row.code ?? row.id.slice(0, 8)}</span>
                    <span className="az-dmain">
                      <span className="az-dstatus" lang="en">{row.status}</span>
                      <span className="az-dsub">{statusVi(row.status)} · {flowVi(row.flow)}</span>
                    </span>
                    <span className="az-dpill">{t('adminAnalytics.topOverdue.overdueDays', { n: row.overdueDays })}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
