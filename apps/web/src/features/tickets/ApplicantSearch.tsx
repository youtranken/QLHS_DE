import { useEffect, useMemo, useState } from 'react'
import { t } from '../../i18n'
import { listMyTickets, type TicketView } from './api'
import { ClosedResultsTable } from '../closed/ClosedResultsTable'
import { StateNotice } from '../../shared/StateNotice'
import { DatePicker } from '../../shared/DatePicker'
import { buildCsv, downloadCsv } from '../../shared/csv'
import { closedCsvRows } from '../closed/closedCsv'

interface Filters {
  code?: string
  contractor?: string
  contractNo?: string
  from?: string
  to?: string
}

const has = (hay: string | null, needle?: string): boolean =>
  !needle?.trim() || (hay ?? '').toLowerCase().includes(needle.trim().toLowerCase())

/**
 * "Tra cứu hồ sơ" for the Applicant. Owner-scoped by construction: `listMyTickets`
 * only ever returns the caller's own dossiers (AD-7 by applicantSub), so — unlike the
 * DCC closed-lookup — it can never surface anyone else's ticket. Same filter form as
 * the DCC page, but the personal list is small so filtering runs client-side (no
 * server paging, no reopen — reopening is DCC1's alone). Click a code → read-only detail.
 */
export function ApplicantSearch({ onBack }: { onBack?: () => void }) {
  const [all, setAll] = useState<TicketView[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState<Filters>({})
  const set = (k: keyof Filters, v: string) => setF((s) => ({ ...s, [k]: v }))

  const fetchMine = () =>
    listMyTickets()
      .then((r) => setAll(r))
      .catch(() => setErr(t('closed.loadErr')))

  useEffect(() => {
    let alive = true
    void listMyTickets()
      .then((r) => alive && setAll(r))
      .catch(() => alive && setErr(t('closed.loadErr')))
    return () => {
      alive = false
    }
  }, [])

  // Client-side filter over the owner's own list. Date range is compared on the
  // date-only prefix; a reversed range (from > to) is swapped so it still matches.
  const shown = useMemo(() => {
    if (!all) return null
    let from = f.from
    let to = f.to
    if (from && to && from > to) [from, to] = [to, from]
    return all.filter(
      (r) =>
        has(r.code, f.code) &&
        has(r.contractor, f.contractor) &&
        has(r.contractNo, f.contractNo) &&
        (!from || r.createdAt.slice(0, 10) >= from) &&
        (!to || r.createdAt.slice(0, 10) <= to),
    )
  }, [all, f])

  function exportCsv() {
    if (!shown || shown.length === 0) return
    const headers = [
      t('closed.thCode'), t('closed.thFlow'), t('closed.thContractor'), t('closed.thAmount'),
      t('closed.csvCurrency'), t('closed.thContractNo'), t('closed.thCreated'), t('closed.thStatus'),
    ]
    downloadCsv(t('closed.csvFilename'), buildCsv(headers, closedCsvRows(shown)))
  }

  const typed = [f.code, f.contractor, f.contractNo].filter(Boolean).join(' ')

  return (
    <section>
      <div className="closedhead">
        {onBack && (
          <button type="button" className="backchip" onClick={onBack} aria-label={t('shell.topbar.homeAria')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}
        <h1>{t('tickets.myList.searchTitle')}</h1>
      </div>

      <form className="panel searchpanel" aria-label={t('closed.searchFormLabel')} onSubmit={(e) => e.preventDefault()}>
        <div className="filterrow">
          <input
            className="mono"
            placeholder={t('closed.fCode')}
            aria-label={t('closed.fCode')}
            value={f.code ?? ''}
            onChange={(e) => set('code', e.target.value)}
          />
          <input
            placeholder={t('closed.fContractor')}
            aria-label={t('closed.fContractor')}
            value={f.contractor ?? ''}
            onChange={(e) => set('contractor', e.target.value)}
          />
          <input
            className="mono"
            placeholder={t('closed.fContractNo')}
            aria-label={t('closed.fContractNo')}
            value={f.contractNo ?? ''}
            onChange={(e) => set('contractNo', e.target.value)}
          />
          <div className="dr">
            <DatePicker value={f.from ?? ''} onChange={(v) => set('from', v)} ariaLabel={t('closed.fFrom')} />
            <span className="arr" aria-hidden>
              →
            </span>
            <DatePicker value={f.to ?? ''} onChange={(v) => set('to', v)} ariaLabel={t('closed.fTo')} />
          </div>
          <button type="button" className="btn ghost" onClick={() => setF({})}>
            {t('closed.clearFilters')}
          </button>
        </div>
      </form>

      <div className="resultbar">
        <span className="count" role="status">
          {shown === null ? (err ? '' : t('closed.loading')) : t('closed.matchCount', { n: shown.length })}
        </span>
        {shown !== null && shown.length > 0 && (
          <button type="button" className="btn ghost sm exportcsv" onClick={exportCsv} aria-label={t('closed.exportAria')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12m0 0-4-4m4 4 4-4" />
              <path d="M5 21h14" />
            </svg>
            {t('closed.exportCsv')}
          </button>
        )}
      </div>

      {all === null && err && (
        <StateNotice kind="error" text={err} onRetry={() => { setErr(null); void fetchMine() }} />
      )}
      {shown !== null && shown.length === 0 && (
        <p role="status" className="empty-note">
          {typed ? t('closed.emptyWithQuery', { query: typed }) : t('closed.emptyNoQuery')}
        </p>
      )}
      {shown !== null && shown.length > 0 && (
        <ClosedResultsTable rows={shown} role="Applicant" onReopen={() => {}} />
      )}
    </section>
  )
}
