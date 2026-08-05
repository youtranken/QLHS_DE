import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { TICKET_EVENT } from '@qlhs/contracts'
import { t } from '../../i18n'
import { StateNotice } from '../../shared/StateNotice'
import { openTicketDetail } from '../../shared/route'
import { AuditEventSelect } from './AuditEventSelect'
import { DatePicker } from '../../shared/DatePicker'
import { getAuditLog, type AuditPage, type AuditQuery } from './api'

const EVENTS = Object.values(TICKET_EVENT)
const RETURN_EVENTS = new Set(['sendBack', 'reopen', 'return_requested', 'reopen_requested'])

function toneOf(action: string): 'acc' | 'ok' | 'bad' | undefined {
  if (RETURN_EVENTS.has(action)) return 'bad'
  if (action === 'created') return 'ok'
  if (/^handover|^sendToAccounting|^submitTo|^confirmReceived|Approve/.test(action)) return 'acc'
  return undefined
}

function fmtDate(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return { date: `${p(d.getDate())}/${p(d.getMonth() + 1)}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` }
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 12h15" />
    <path d="m13 6 6 6-6 6" />
  </svg>
)

const EMPTY: AuditQuery = { code: '', sub: '', event: '', from: '', to: '' }

export function AdminAudit() {
  const [form, setForm] = useState<AuditQuery>(EMPTY)
  const [applied, setApplied] = useState<AuditQuery>(EMPTY)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AuditPage | null>(null)
  const [error, setError] = useState(false)
  const set = (k: keyof AuditQuery, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const load = useCallback(async () => {
    try {
      setData(await getAuditLog({ ...applied, page }))
    } catch {
      setError(true)
    }
  }, [applied, page])

  useEffect(() => {
    void load()
  }, [load])

  function apply(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    // Guard an inverted range: dates are ISO yyyy-mm-dd so string order = chrono
    // order; swap so the API query never receives from > to.
    const norm =
      form.from && form.to && form.from > form.to ? { ...form, from: form.to, to: form.from } : form
    if (norm !== form) setForm(norm)
    setApplied(norm)
  }
  function clear() {
    setForm(EMPTY)
    setApplied(EMPTY)
    setPage(1)
  }

  const todayTotal = data?.today.reduce((s, r) => s + r.count, 0) ?? 0

  return (
    <section aria-label={t('adminAudit.title')}>
      <h1 className="sr-only">{t('adminAudit.title')}</h1>
      <form className="sec" aria-label={t('adminAudit.filters.aria')} onSubmit={apply}>
            <div className="sec-head">
              <h2 className="sec-title">{t('adminAudit.filters.heading')}</h2>
            </div>
            <div className="card filter-card">
              <div className="filter-grid">
                <div className="field field-code">
                  <label htmlFor="a-code">{t('adminAudit.filters.code')}</label>
                  <input id="a-code" className="txt-input mono" placeholder={t('adminAudit.filters.codePlaceholder')} value={form.code} onChange={(e) => set('code', e.target.value)} />
                </div>
                <div className="field field-event">
                  <label>{t('adminAudit.filters.event')}</label>
                  <AuditEventSelect
                    value={form.event ?? ''}
                    onChange={(v) => set('event', v)}
                    events={EVENTS}
                    allLabel={t('adminAudit.filters.allEvents')}
                    ariaLabel={t('adminAudit.filters.event')}
                  />
                </div>
                <div className="field field-dates">
                  <label>{t('adminAudit.filters.dateRange')}</label>
                  <div className="daterange">
                    <DatePicker value={form.from ?? ''} onChange={(v) => set('from', v)} ariaLabel={t('adminAudit.filters.fromAria')} />
                    <span className="arrow" aria-hidden>
                      <Arrow />
                    </span>
                    <DatePicker value={form.to ?? ''} onChange={(v) => set('to', v)} ariaLabel={t('adminAudit.filters.toAria')} />
                  </div>
                </div>
                <div className="filter-actions">
                  <button type="submit" className="btn primary">
                    <Search aria-hidden />
                    {t('adminAudit.filters.apply')}
                  </button>
                  <button type="button" className="btn ghost" onClick={clear}>
                    {t('adminAudit.filters.clear')}
                  </button>
                </div>
              </div>
            </div>
      </form>

      <div className="audit-grid">
        <div className="audit-main">
          {error && (
            <StateNotice
              kind="error"
              text={t('adminAudit.loadError')}
              onRetry={() => {
                setError(false)
                void load()
              }}
            />
          )}

          {!error && (
            <section className="sec" aria-label={t('adminAudit.table.aria')}>
              <div className="sec-head">
                <h2 className="sec-title">{t('adminAudit.table.heading')}</h2>
                {data && <span className="sec-note">{t('adminAudit.table.matchCount', { n: data.total })}</span>}
              </div>
              <div className="card table-card">
                <div className="tbl-scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th scope="col">{t('adminAudit.table.time')}</th>
                        <th scope="col">{t('adminAudit.table.ticket')}</th>
                        <th scope="col">{t('adminAudit.table.actor')}</th>
                        <th scope="col">{t('adminAudit.table.event')}</th>
                        <th scope="col">{t('adminAudit.table.fromTo')}</th>
                        <th scope="col">{t('adminAudit.table.reason')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.events.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: 22, textAlign: 'center', color: 'var(--ink-3)' }}>
                            {t('adminAudit.table.empty')}
                          </td>
                        </tr>
                      )}
                      {data?.events.map((e) => {
                        const when = fmtDate(e.occurredAt)
                        const tone = toneOf(e.action)
                        const noChange = e.fromStatus === e.toStatus
                        return (
                          <tr key={e.id} className={RETURN_EVENTS.has(e.action) ? 'ev-return' : undefined}>
                            <td data-label={t('adminAudit.table.time')}>
                              <span className="tm">
                                <span className="d">{when.date}</span>
                                <span className="h">{when.time}</span>
                              </span>
                            </td>
                            <td data-label={t('adminAudit.table.ticket')}>
                              <button type="button" className="code-btn" onClick={() => openTicketDetail(e.ticketId)}>
                                {e.code ?? e.ticketId.slice(0, 8)}
                              </button>
                            </td>
                            <td data-label={t('adminAudit.table.actor')}>
                              <span className="who">
                                <span className="nm">{e.actorName}</span>
                              </span>
                            </td>
                            <td data-label={t('adminAudit.table.event')}>
                              <span className={tone ? `chip ${tone}` : 'chip'} lang="en">
                                {e.action}
                              </span>
                            </td>
                            <td data-label={t('adminAudit.table.fromTo')}>
                              {noChange ? (
                                <span className="trans">
                                  <span className="none">{t('adminAudit.table.noChange')}</span>
                                </span>
                              ) : (
                                <span className="trans" lang="en">
                                  {e.fromStatus} <span className="arw">→</span> {e.toStatus}
                                </span>
                              )}
                            </td>
                            <td data-label={t('adminAudit.table.reason')}>
                              {e.reason ? (
                                <span className="reason" title={e.reason}>
                                  {e.reason}
                                </span>
                              ) : (
                                <span className="reason dash">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {data && (
                <div className="pager">
                  <div className="pinfo">
                    {t('adminAudit.pager.info', { page: data.page, totalPages: data.totalPages, total: data.total })}
                  </div>
                  <div className="pgap" />
                  <button type="button" className="btn secondary sm" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    {t('adminAudit.pager.prev')}
                  </button>
                  <button type="button" className="btn secondary sm" disabled={data.page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                    {t('adminAudit.pager.next')}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {!error && (
        <aside className="audit-side">
          <div className="card today-card" aria-label={t('adminAudit.today.title')}>
            <div className="today-head">
              <span className="eyebrow">{t('adminAudit.today.title')}</span>
              {todayTotal > 0 && <span className="n">{t('adminAudit.today.count', { n: todayTotal })}</span>}
            </div>
            {!data || data.today.length === 0 ? (
              <div className="empty">
                <div className="empty-help">{t('adminAudit.today.empty')}</div>
              </div>
            ) : (
              data.today.map((row) => (
                <div className={RETURN_EVENTS.has(row.action) ? 'today-row hot' : 'today-row'} key={row.action}>
                  <span className="lbl" lang="en">
                    {row.action}
                  </span>
                  <span className="cnt">{row.count}</span>
                </div>
              ))
            )}
          </div>
        </aside>
        )}
      </div>
    </section>
  )
}
