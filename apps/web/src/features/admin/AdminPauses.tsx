import { useCallback, useEffect, useState } from 'react'
import { applyVp, t } from '../../i18n'
import { StateNotice } from '../../shared/StateNotice'
import { getSlaPauses, type SlaPauseReport } from './api'

/** Giám sát F8 — mọi đồng hồ SLA đang bị dừng. Pause là hành động DUY NHẤT làm
 *  badge đẹp lên mà không ai làm việc gì, nên nó phải có chỗ nhìn thấy được:
 *  ai dừng, vì sao, bao lâu, và ga nào đang dựa vào pause nhiều nhất. Chỉ đọc,
 *  mọi số derive ở read từ `ticket_sla_pause` (AD-6) — không bảng mới. */
export function AdminPauses() {
  const [r, setR] = useState<SlaPauseReport | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setError(false)
    setR(null)
    getSlaPauses()
      .then(setR)
      .catch(() => setError(true))
  }, [])
  useEffect(() => load(), [load])

  const stale = r?.open.filter((p) => p.stale).length ?? 0

  return (
    <section aria-label={t('adminSla.pauses.title')}>
      <h1 className="sr-only">{t('adminSla.pauses.title')}</h1>
      {error && <StateNotice kind="error" text={t('adminSla.pauses.loadError')} onRetry={load} />}
      {!error && !r && <StateNotice kind="loading" text={t('adminSla.pauses.loading')} />}

      {r && (
        <>
          <div className="pause-info">
            <span className="pi-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5" />
                <path d="M12 8h.01" />
              </svg>
            </span>
            <p>
              {t('adminSla.pauses.infoP1')}<b>{t('adminSla.pauses.infoB1')}</b>{t('adminSla.pauses.infoP2')}{' '}
              <b>{t('adminSla.pauses.infoB2', { n: r.staleAfterDays })}</b>{t('adminSla.pauses.infoP3')}
            </p>
          </div>

          <div className="pause-grid">
            <section className="pause-sec" aria-label={t('adminSla.pauses.openTitle')}>
              <div className="pause-sechd">
                <h2 className="sec-title">{t('adminSla.pauses.openTitle')}</h2>
                <span className={stale > 0 ? 'pause-count warn' : 'pause-count'}>
                  {t('adminSla.pauses.openCount', { n: r.open.length })}{stale > 0 ? t('adminSla.pauses.staleSuffix', { n: stale }) : ''}
                </span>
              </div>
              <div className="card pause-list">
                {r.open.length === 0 ? (
                  <div className="empty">
                    <div className="empty-ic" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="8.5" />
                        <path d="M12 7.5V12l3 2" />
                      </svg>
                    </div>
                    <div className="empty-title">{t('adminSla.pauses.openEmptyTitle')}</div>
                    <div className="empty-help">{t('adminSla.pauses.openEmpty')}</div>
                  </div>
                ) : (
                  r.open.map((p) => (
                    <div className={p.stale ? 'pzrow stale' : 'pzrow'} key={p.ticketId}>
                      <div className="pzmain">
                        <div className="pztop">
                          <span className="pzcode">{p.code ?? p.ticketId.slice(0, 8)}</span>
                          {p.stale && (
                            <span className="tag-stale">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 9v4" />
                                <path d="M12 17h.01" />
                                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                              </svg>
                              {t('adminSla.pauses.staleTag')}
                            </span>
                          )}
                        </div>
                        <div className="pzreason">{p.reason}</div>
                        <div className="pzmeta">
                          <span className="st" lang="en">{applyVp(p.status)}</span>
                          <span className="dot" />
                          <span>{p.pausedByName}</span>
                        </div>
                      </div>
                      <div className="pzdays">
                        {p.pausedDays}
                        <span className="u">{t('adminSla.pauses.daysUnit')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="pause-sec" aria-label={t('adminSla.pauses.byStationAria')}>
              <div className="pause-sechd">
                <h2 className="sec-title">{t('adminSla.pauses.byStationTitle')}</h2>
                <span className="pause-note">{t('adminSla.pauses.windowDays', { n: r.windowDays })}</span>
              </div>
              <div className="card freq-list">
                {r.byStation.length === 0 ? (
                  <p className="pz-empty">{t('adminSla.pauses.byStationEmpty')}</p>
                ) : (
                  r.byStation.map((s) => (
                    <div className="freq-row" key={s.status}>
                      <div className="freq-main">
                        <div className="freq-status">
                          <span className="st-dot" />
                          <span className="freq-name" lang="en">{applyVp(s.status)}</span>
                        </div>
                        <div className="freq-meta">
                          {t('adminSla.pauses.stationMeta', { pauses: s.pauses, tickets: s.tickets, days: s.longestDays })}
                        </div>
                      </div>
                      <span className={s.openNow > 0 ? 'freq-active over' : 'freq-active'}>
                        {t('adminSla.pauses.openNow', { n: s.openNow })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  )
}
