import { Fragment, type ReactNode, useCallback, useRef, useState } from 'react'
import { useLiveRefetch } from '../../shared/useLiveRefetch'
import {
  cancelTicket,
  getTicketDetail,
  listMyTickets,
  type TicketDetail,
  type TicketView,
} from './api'
import { TicketRow } from './TicketRow'
import { TicketDetailModal } from './TicketDetailModal'
import { openCreateFormWith } from './CreateTicketForm'
import { CLOSED, RETURN_STATES, type Filter } from './ticketStates'
import { StateNotice } from '../../shared/StateNotice'
import { openSearch } from '../../shared/route'
import { ConfirmModal } from '../../shared/ConfirmModal'
import { toast } from '../../shared/toast'
import { t } from '../../i18n'

export function MyTickets({ reloadKey, action }: { reloadKey: number; action?: ReactNode }) {
  // Built per render (not module-level) so a future locale switch re-evaluates.
  const FILTERS: Array<{ v: Filter; label: string; hot?: boolean }> = [
    { v: 'all', label: t('tickets.myList.filterAll') },
    { v: 'running', label: t('tickets.myList.filterRunning') },
    { v: 'returned', label: t('tickets.myList.filterReturned'), hot: true },
    { v: 'closed', label: t('tickets.myList.filterClosed') },
  ]
  const [tickets, setTickets] = useState<TicketView[]>([])
  const [loaded, setLoaded] = useState(false)
  // Applicants land on "Đang chạy" — the tickets they're actively waiting on — not
  // the full pile (closed history dominates over time).
  const [flt, setFlt] = useState<Filter>('running')
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  // Mirror the open row into a ref so the live-refetch callback (captured once by
  // the SSE subscription) can read the CURRENT expanded id without re-subscribing.
  const openRef = useRef<string | null>(null)
  openRef.current = openId
  const [error, setError] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  // A failed refetch after the first successful load keeps the stale list (the
  // error box only shows before anything loaded); live-refetch retries anyway.
  const load = useCallback(async () => {
    try {
      setTickets(await listMyTickets())
      setError(null)
      setLoaded(true)
    } catch {
      setError(t('tickets.myList.loadErr'))
    }
  }, [])

  // Keep the expanded row open across refetches (AC5): only re-fetch, don't
  // collapse. Driven by the SSE stream now (2.1) so a Return lands in the
  // applicant's list the moment DCC1 sends it back, not up to 4s later. Also
  // refresh the OPEN row's detail — otherwise the list flips to "Returned" while
  // the expanded panel keeps the stale route and hides the ReturnPanel (UX H1).
  const refetch = useCallback(async () => {
    await load()
    const id = openRef.current
    if (!id) return
    try {
      setDetail(await getTicketDetail(id))
    } catch {
      /* keep last-known detail; the list already refreshed */
    }
  }, [load])
  useLiveRefetch(() => void refetch(), [reloadKey])

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null)
      setDetail(null)
      return
    }
    setOpenId(id)
    try {
      setDetail(await getTicketDetail(id))
    } catch {
      toast.err(t('tickets.detail.errLoad'))
      setOpenId(null)
    }
  }

  async function doCancel() {
    const id = cancelId
    setCancelId(null)
    if (!id) return
    try {
      await cancelTicket(id)
      toast.ok(t('tickets.myList.cancelToast'))
      await load()
    } catch {
      toast.err(t('tickets.myList.cancelErr'))
    }
  }

  async function onReturnDone(detailId: string) {
    try {
      setDetail(await getTicketDetail(detailId))
    } catch {
      /* list still refreshes below; panel keeps last-known detail */
    }
    await load()
  }

  // Clone: seed the create form from an existing ticket (all rows here are the
  // applicant's own), then POST as a normal new ticket.
  async function clone(id: string) {
    try {
      const d = await getTicketDetail(id)
      openCreateFormWith({
        documentType: d.documentType ?? 'General',
        description: d.description ?? '',
        paymentTerm: d.paymentTerm ?? '',
        contractNo: d.contractNo ?? '',
        projectTeam: d.projectTeam ?? '',
        currency: d.currency ?? 'VND',
        amount: d.amount ?? '',
        budgetCode: d.budgetCode ?? '',
        contractor: d.contractor ?? '',
        priority: 'normal',
      })
      toast.info(t('tickets.myList.cloneToast'))
    } catch {
      toast.err(t('tickets.detail.errLoad'))
    }
  }

  const byCreated = (a: TicketView, b: TicketView) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  const returned = tickets.filter((t) => RETURN_STATES.has(t.status)).sort(byCreated)
  const closed = tickets.filter((t) => CLOSED.has(t.status)).sort(byCreated)
  const running = tickets
    .filter((t) => !CLOSED.has(t.status) && !RETURN_STATES.has(t.status))
    .sort(byCreated)

  const count: Record<Filter, number> = {
    all: tickets.length,
    running: running.length,
    returned: returned.length,
    closed: closed.length,
  }

  const groups: Array<{ key: Filter; label: string; warn?: boolean; rows: TicketView[] }> = [
    { key: 'returned', label: t('tickets.myList.groupReturned', { n: returned.length }), warn: true, rows: returned },
    { key: 'running', label: t('tickets.myList.groupRunning', { n: running.length }), rows: running },
    { key: 'closed', label: t('tickets.myList.groupClosed', { n: closed.length }), rows: closed },
  ]
  const visible = groups.filter((g) => (flt === 'all' ? g.rows.length > 0 : g.key === flt))
  const total = visible.reduce((n, g) => n + g.rows.length, 0)
  // Running row number across the visible groups (STT 1,2,3…).
  const seqOf = new Map<string, number>()
  let seqN = 0
  for (const g of visible) for (const tk of g.rows) seqOf.set(tk.id, ++seqN)

  return (
    <div>
      {/* Title now lives in the topbar; keep an sr-only heading for a11y. */}
      <h1 className="sr-only">{t('tickets.myList.title')}</h1>

      <section className="kpis" aria-label={t('tickets.myList.kpiAria')} style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="lbl">{t('tickets.myList.kpiRunning')}</div>
          <div className="val">{running.length}</div>
          <div className="sub2">{t('tickets.myList.kpiRunningSub')}</div>
        </div>
        <div className={`kpi${returned.length > 0 ? ' hot' : ''}`}>
          <div className="lbl">{t('tickets.myList.kpiReturned')}</div>
          <div className="val">{returned.length}</div>
          <div className="sub2">{t('tickets.myList.kpiReturnedSub')}</div>
        </div>
        <div className="kpi">
          <div className="lbl">{t('tickets.myList.kpiClosed')}</div>
          <div className="val">{closed.length}</div>
          <div className="sub2">{t('tickets.myList.kpiClosedSub')}</div>
        </div>
      </section>

      <div className="filterbar">
        <div className="seg" role="group" aria-label={t('tickets.myList.filterAria')}>
          {FILTERS.map((f) => (
            <button
              key={f.v}
              type="button"
              aria-pressed={flt === f.v}
              className={`${flt === f.v ? 'on' : ''}${f.hot && count.returned > 0 ? ' hotf' : ''}`}
              onClick={() => setFlt(f.v)}
            >
              {f.label} ({count[f.v]})
            </button>
          ))}
        </div>
        <span className="cnt">{t('tickets.myList.visibleCount', { n: total })}</span>
        <button type="button" className="btn ghost sm" onClick={openSearch}>
          {/* Same archive-box glyph as the DCC board "Tìm hồ sơ" button, for parity. */}
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2.5" y="4" width="19" height="4.5" rx="1" />
            <path d="M4.5 8.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V8.5" />
            <path d="M10 12.5h4" />
          </svg>
          {t('tickets.myList.searchBtn')}
        </button>
        <span className="fb-action">{action}</span>
      </div>

      {!loaded && error ? (
        <StateNotice kind="error" text={error} onRetry={() => void load()} />
      ) : !loaded ? (
        <div className="tblwrap" aria-label={t('tickets.myList.loadingAria')} aria-busy="true">
          <div className="skelrows">
            <div className="skel" />
            <div className="skel" />
            <div className="skel" />
            <div className="skel" />
          </div>
        </div>
      ) : total === 0 ? (
        <p className="empty-note">
          {flt === 'returned'
            ? t('tickets.myList.emptyReturned')
            : flt === 'running'
              ? t('tickets.myList.emptyRunning')
              : flt === 'closed'
                ? t('tickets.myList.emptyClosed')
                : t('tickets.myList.emptyAll')}
        </p>
      ) : (
        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col" className="seq">{t('tickets.myList.colSeq')}</th>
                <th scope="col">{t('tickets.myList.colCode')}</th>
                <th scope="col" className="subj">{t('tickets.myList.colSubject')}</th>
                <th scope="col">{t('tickets.myList.colDocType')}</th>
                <th scope="col">{t('tickets.myList.colContractor')}</th>
                <th scope="col">{t('tickets.myList.colContractNo')}</th>
                <th scope="col">{t('tickets.myList.colProjectTeam')}</th>
                <th scope="col" className="num">
                  {t('tickets.myList.colAmount')}
                </th>
                <th scope="col">{t('tickets.myList.colPaymentTerm')}</th>
                <th scope="col">{t('tickets.myList.colBudget')}</th>
                <th scope="col">{t('tickets.myList.colStatus')}</th>
                <th scope="col">
                  <span className="sr-only">{t('tickets.myList.colActions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => (
                <Fragment key={g.key}>
                  <tr className={`grouphd${g.warn ? ' warn' : ''}`}>
                    <td colSpan={12}>{g.label}</td>
                  </tr>
                  {g.rows.map((t) => (
                    <TicketRow
                      key={t.id}
                      t={t}
                      seq={seqOf.get(t.id) ?? 0}
                      openId={openId}
                      detail={detail}
                      onToggle={(id) => void toggle(id)}
                      onDetail={(id) => setDetailId(id)}
                      onCancel={(id) => setCancelId(id)}
                      onClone={(id) => void clone(id)}
                      onReturnDone={onReturnDone}
                    />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cancelId && (
        <ConfirmModal
          message={t('tickets.myList.confirmCancel')}
          danger
          confirmLabel={t('tickets.myList.cancelBtn')}
          onConfirm={doCancel}
          onCancel={() => setCancelId(null)}
        />
      )}

      {detailId && (
        <TicketDetailModal
          ticketId={detailId}
          onClose={() => {
            setDetailId(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
