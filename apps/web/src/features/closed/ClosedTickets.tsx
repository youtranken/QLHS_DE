import { useCallback, useEffect, useState } from 'react'
import { t } from '../../i18n'
import type { TicketView } from '../tickets/api'
import { ConfirmModal } from '../../shared/ConfirmModal'
import { StateNotice } from '../../shared/StateNotice'
import { toast } from '../../shared/toast'
import { ClosedResultsTable } from './ClosedResultsTable'
import { DatePicker } from '../../shared/DatePicker'
import { buildCsv, downloadCsv } from '../../shared/csv'
import { closedCsvRows } from './closedCsv'
import { reopenClosed, requestReopen, searchClosed, type ClosedFilters } from './api'

// 'All' là giá trị nội bộ (không dịch); nhãn hiển thị lấy từ catalog lúc render.
const FLOWS = ['All', 'Contract', 'Payment', 'General'] as const

/**
 * FR-17 "Closed tickets" lookup tab (DCC 1/2/3). A search surface for finding an
 * old ticket to review or reopen — flow scope is enforced by the server; the flow
 * chip narrows the returned set client-side. Empty results show a try-fewer hint
 * (UX-DR13), never a bare "no data". Click a code to open the read-only detail.
 */
export function ClosedTickets({ role, onBack }: { role?: string | null; onBack?: () => void }) {
  const [f, setF] = useState<ClosedFilters>({})
  const [rows, setRows] = useState<TicketView[] | null>(null)
  const [flow, setFlow] = useState<(typeof FLOWS)[number]>('All')
  const [busy, setBusy] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [reopenId, setReopenId] = useState<string | null>(null)
  // Paging: `cursor` is the server's token for the next slice (null = no more);
  // `activeQ` is the filter set that produced the current list, so "load more"
  // pages the SAME query even after the form inputs change but aren't submitted.
  const [cursor, setCursor] = useState<string | null>(null)
  const [activeQ, setActiveQ] = useState<ClosedFilters>({})
  const [more, setMore] = useState(false)
  const set = (k: keyof ClosedFilters, v: string) => setF((s) => ({ ...s, [k]: v }))

  // Mở trang là có sẵn hồ sơ đóng gần nhất — không để màn trắng (UX-DR: never a
  // blank surface). Người dùng lọc để thu hẹp từ tập mặc định này.
  const loadDefault = useCallback(async () => {
    setLoadErr(null)
    try {
      const p = await searchClosed({})
      setRows(p.items)
      setCursor(p.nextCursor)
      setActiveQ({})
    } catch {
      setLoadErr(t('closed.loadErr'))
    }
  }, [])

  useEffect(() => {
    let alive = true
    void searchClosed({})
      .then((p) => {
        if (!alive) return
        setRows(p.items)
        setCursor(p.nextCursor)
        setActiveQ({})
      })
      .catch(() => alive && setLoadErr(t('closed.loadErr')))
    return () => {
      alive = false
    }
  }, [])

  async function loadMore() {
    if (!cursor || more) return
    setMore(true)
    try {
      const p = await searchClosed(activeQ, cursor)
      setRows((prev) => [...(prev ?? []), ...p.items])
      setCursor(p.nextCursor)
    } catch {
      toast.err(t('closed.searchErr'))
    } finally {
      setMore(false)
    }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      // Khoảng ngày chọn ngược (from > to) → hoán đổi để không gửi range đảo.
      const q = { ...f }
      if (q.from && q.to && q.from > q.to) [q.from, q.to] = [q.to, q.from]
      const p = await searchClosed(q)
      setRows(p.items)
      setCursor(p.nextCursor)
      setActiveQ(q)
      setLoadErr(null)
    } catch {
      toast.err(t('closed.searchErr'))
    } finally {
      setBusy(false)
    }
  }

  async function doReopen(id: string, reason: string) {
    try {
      await reopenClosed(id, reason)
      toast.ok(t('closed.reopenDone'))
      const p = await searchClosed(activeQ)
      setRows(p.items)
      setCursor(p.nextCursor)
    } catch {
      toast.err(t('closed.reopenFailed'))
    }
  }

  async function propose(id: string) {
    try {
      await requestReopen(id)
      toast.ok(t('closed.proposeSent'))
    } catch {
      toast.err(t('closed.proposeFailed'))
    }
  }

  function clearFilters() {
    setF({})
    setFlow('All')
  }

  function exportCsv() {
    if (!shown || shown.length === 0) return
    const headers = [
      t('closed.thCode'), t('closed.thFlow'), t('closed.thContractor'), t('closed.thAmount'),
      t('closed.csvCurrency'), t('closed.thContractNo'), t('closed.thCreated'), t('closed.thStatus'),
    ]
    downloadCsv(t('closed.csvFilename'), buildCsv(headers, closedCsvRows(shown)))
  }

  const typed = [f.code, f.contractor, f.contractNo].filter(Boolean).join(' ')
  const shown = rows?.filter((r) => flow === 'All' || r.flow === flow) ?? null

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
        <h1>{t('closed.title')}</h1>
      </div>

      <form className="panel searchpanel" aria-label={t('closed.searchFormLabel')} onSubmit={run}>
        <div className="filterrow">
          <input
            className="mono"
            placeholder={t('closed.fCode')}
            aria-label={t('closed.fCode')}
            title={t('closed.fCode')}
            value={f.code ?? ''}
            onChange={(e) => set('code', e.target.value)}
          />
          <input
            placeholder={t('closed.fContractor')}
            aria-label={t('closed.fContractor')}
            title={t('closed.fContractor')}
            value={f.contractor ?? ''}
            onChange={(e) => set('contractor', e.target.value)}
          />
          <input
            className="mono"
            placeholder={t('closed.fContractNo')}
            aria-label={t('closed.fContractNo')}
            title={t('closed.fContractNo')}
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
          <button type="submit" className="btn primary" disabled={busy}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.4-3.4" />
            </svg>
            {busy ? t('closed.searching') : t('closed.search')}
          </button>
          <button type="button" className="btn ghost" onClick={clearFilters}>
            {t('closed.clearFilters')}
          </button>
        </div>
      </form>

      <div className="resultbar">
        <span className="count" role="status">
          {shown === null
            ? loadErr
              ? ''
              : t('closed.loading')
            : t('closed.matchCount', { n: shown.length })}
        </span>
        {role === 'DCC1' && rows !== null && rows.length > 0 && (
          <div className="chips" role="group" aria-label={t('closed.flowFilterLabel')}>
            {FLOWS.map((fl) => (
              <button key={fl} type="button" aria-pressed={flow === fl} className={`fchip${flow === fl ? ' on' : ''}`} onClick={() => setFlow(fl)}>
                {fl === 'All' ? t('closed.flowAll') : <span lang="en">{fl}</span>}
              </button>
            ))}
          </div>
        )}
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

      {rows === null && loadErr && (
        <StateNotice kind="error" text={loadErr} onRetry={() => void loadDefault()} />
      )}
      {shown !== null && shown.length === 0 && (
        <p role="status" className="empty-note">
          {typed ? t('closed.emptyWithQuery', { query: typed }) : t('closed.emptyNoQuery')}
        </p>
      )}
      {shown !== null && shown.length > 0 && (
        <ClosedResultsTable
          rows={shown}
          role={role}
          onReopen={(id) => setReopenId(id)}
          onPropose={(id) => void propose(id)}
        />
      )}

      {rows !== null && rows.length > 0 && cursor && (
        <div className="loadmore">
          <button type="button" className="btn ghost" onClick={() => void loadMore()} disabled={more}>
            {more ? t('closed.loadingMore') : t('closed.loadMore')}
          </button>
        </div>
      )}

      {reopenId && (
        <ConfirmModal
          title={t('closed.reopenModalTitle')}
          message={t('closed.reopenModalMessage')}
          reason
          danger
          confirmLabel={t('closed.reopenConfirm')}
          onConfirm={async (reason) => {
            const id = reopenId
            setReopenId(null)
            await doReopen(id, reason ?? '')
          }}
          onCancel={() => setReopenId(null)}
        />
      )}
    </section>
  )
}
