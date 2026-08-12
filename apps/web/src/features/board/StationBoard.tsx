import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveRefetch } from '../../shared/useLiveRefetch'
import { getStationBoard, type BoardCard, type BoardColumn } from './api'
import { BatchSendAccountingModal } from './BatchSendAccountingModal'
import { BoardActionModals } from './BoardActionModals'
import { StateNotice } from '../../shared/StateNotice'
import { BoardCardView } from './BoardCardView'
import { BulkActionBar } from './BulkActionBar'
import { bulkSelectGroups, commonBulkActions, columnHasBulkAction, isBulkable } from './bulkActions'
import { cardMatches, type BoardFilter } from './boardFilter'
import { BoardFilterBar } from './BoardFilterBar'
import { useBoardActions } from './useBoardActions'
import { statusVi } from '../tickets/statusLabel'
import { TriangleAlert } from 'lucide-react'
import { openSearch } from '../../shared/route'
import { applyVp, t } from '../../i18n'

/** DCC "Trạm của tôi" board: columns per station, each card has a keyboard-
 *  accessible ⋯ menu of legal actions (AD-17). Drag-drop is an enhancement of
 *  this same launcher; the ⋯ menu is the required keyboard-equivalent path.
 *  `canManage` (DCC1 only) unlocks the flow filter + any-status priority picker
 *  (FR-1). Bulk-select is available to DCC1 (Andy decisions, FR-8) AND DCC2 (bulk
 *  hardcopy confirm / complete) — `canBulk` below. */
export function StationBoard({
  canManage = false,
  dcc2 = false,
  dcc3 = false,
}: { canManage?: boolean; dcc2?: boolean; dcc3?: boolean } = {}) {
  // Who may bulk-select: DCC1 (its stations), DCC2 (Contract hardcopy close) or DCC3
  // (Payment hardcopy confirm). The card actions are role-scoped server-side, so a
  // column only offers a bulk action the viewer can actually take.
  const canBulk = canManage || dcc2 || dcc3
  const [cols, setCols] = useState<BoardColumn[]>([])
  const [q, setQ] = useState('')
  const [overOnly, setOverOnly] = useState(false)
  const [flow, setFlow] = useState<string>('All')
  const [priority, setPriority] = useState<string>('All')
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set())
  // "Enter Contract No / Payment No for many" — the cards of a Received-by-DCC2/DCC3
  // column, opened in one batch-entry sheet. Null when closed.
  const [batchSend, setBatchSend] = useState<BoardCard[] | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastOk, setLastOk] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Power-user shortcuts: "/" focuses the board search, "n" opens the ticket
  // lookup. Ignored while typing in a field so they don't hijack literal keys,
  // and while a modal is open — "n" there would unmount the board mid-action.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (document.querySelector('[role="dialog"]')) return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'n') {
        e.preventDefault()
        openSearch()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // A failed refetch after the first successful load keeps the stale board (the
  // pre-load error box only shows before anything loaded); once loaded, a failed
  // refetch surfaces as the "reconnecting" chip instead. Live-refetch retries anyway.
  const load = useCallback(async () => {
    try {
      setCols(await getStationBoard())
      setError(null)
      setLoaded(true)
      setLastOk(Date.now())
    } catch {
      setError(t('board.loadErr'))
    }
  }, [])

  useLiveRefetch(() => void load())

  const {
    handover, sendAcc, receiveAcc, ask, inFlight,
    setHandover, setSendAcc, setReceiveAcc, setAsk,
    run, doSeize, doReceive, doMissing, doSendAcc, doReceiveAcc,
    doBatch,
  } = useBoardActions(load)

  const filter: BoardFilter = { q, overOnly, flow, priority }
  const match = (c: BoardCard) => cardMatches(c, filter)
  const filterActive = q.trim() !== '' || overOnly || flow !== 'All' || priority !== 'All'
  const noMatches = filterActive && loaded && cols.every((col) => !col.cards.some(match))
  const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  // Bulk-select is DCC1-only and offered on every real station column (not the
  // reconcile lane). The bulk bar only shows actions legal for the WHOLE selection
  // (commonBulkActions), so selecting a mix of statuses simply yields no bulk action.
  const toggleSel = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  // Column "select all": toggle a given set of bulk-selectable cards at once. The
  // Andy column passes one set per bulk family (see bulkSelectGroups) so a mixed
  // General + Contract/Payment column gets a checkbox each, never a dead bulk bar.
  const toggleAll = (cards: BoardCard[]) =>
    setSel((prev) => {
      const ids = cards.map((c) => c.id)
      const allSel = ids.length > 0 && ids.every((id) => prev.has(id))
      const n = new Set(prev)
      for (const id of ids) allSel ? n.delete(id) : n.add(id)
      return n
    })
  const selectedCards = cols.flatMap((c) => c.cards).filter((c) => sel.has(c.id))
  const bulkActions = commonBulkActions(selectedCards)

  return (
    <section>
      <div className="boardhead">
        <h2>{t('board.header.title')}</h2>
        {loaded && (
          <span className={`boardsync${error ? ' stale' : ''}`} role="status" aria-live="polite">
            {error
              ? t('board.sync.reconnecting')
              : lastOk
                ? t('board.sync.updated', { time: hhmm(lastOk) })
                : ''}
          </span>
        )}
        {/* Facets live on this same header row now (next to the "Cập nhật …" cue). */}
        <BoardFilterBar canManage={canManage} filter={filter} onFlow={setFlow} onPriority={setPriority} />
        <label className="srch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={searchRef}
            placeholder={t('board.search.placeholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('board.search.aria')}
          />
        </label>
        <button
          type="button"
          className={`chiptoggle${overOnly ? ' on' : ''}`}
          aria-pressed={overOnly}
          aria-label={t('board.filter.overOnlyAria')}
          onClick={() => setOverOnly((v) => !v)}
        >
          <TriangleAlert size={13} aria-hidden />
          {t('board.filter.overOnly')}
        </button>
        <button type="button" className="newbtn" onClick={openSearch} aria-keyshortcuts="n">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2.5" y="4" width="19" height="4.5" rx="1" />
            <path d="M4.5 8.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V8.5" />
            <path d="M10 12.5h4" />
          </svg>
          {t('board.header.findTicket')}
        </button>
      </div>
      {canBulk && (
        <BulkActionBar
          count={selectedCards.length}
          actions={bulkActions}
          onApply={(action, alsoComplete) =>
            doBatch(selectedCards, action, () => setSel(new Set()), { alsoComplete })
          }
          onClear={() => setSel(new Set())}
        />
      )}
      {!loaded && error ? (
        <StateNotice kind="error" text={error} onRetry={() => void load()} />
      ) : !loaded ? (
        <div className="cols" aria-busy="true" aria-label={t('board.loadingAria')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="col">
              <div className="cb skelrows">
                <div className="skel" />
                <div className="skel" />
              </div>
            </div>
          ))}
        </div>
      ) : noMatches ? (
        <StateNotice kind="empty" text={t('board.noMatchAll')} />
      ) : (
      <div className="cols">
        {cols.map((col) => {
          const cls = col.reconcile ? ' reccol' : col.overSla ? ' hotcol' : ''
          const shown = col.cards.filter(match)
          // Received-by-DCC2/DCC3 columns: each card needs its own Contract No /
          // Payment No, so offer a batch-entry sheet instead of a one-action bulk.
          const batchCards = shown.filter((c) => c.actions.some((a) => a.event === 'sendToAccounting'))
          // Cards in this column the DCC1 can bulk-select; drives the "select all" chip.
          const selectableCards = canBulk && !col.reconcile ? shown.filter((c) => c.actions.some(isBulkable)) : []
          // One "select all" per bulk family — the Andy column splits General vs
          // Contract/Payment so a mixed pick never leaves the bulk bar empty.
          const selGroups = bulkSelectGroups(selectableCards)
          return (
            <div key={col.reconcile ? 'reconcile' : col.status} className={`col${cls}`}>
              <div className="ch">
                <div className="r1">
                  <span className="st" lang={col.label ? undefined : 'en'}>
                    {col.label ?? applyVp(col.status)}
                  </span>
                  {col.overSla && (
                    <span className="colwarn" aria-label={t('board.column.overSla')} title={t('board.column.overSla')}>
                      <TriangleAlert size={13} aria-hidden />
                    </span>
                  )}
                  <span className="n" title={filterActive ? t('board.column.countFiltered', { shown: shown.length, total: col.cards.length }) : undefined}>
                    {filterActive && shown.length !== col.cards.length
                      ? `${shown.length}/${col.cards.length}`
                      : col.cards.length}
                  </span>
                </div>
                {/* Reconcile lane: its label already carries the full message, so no
                    second sub-line — normal columns keep the VN status caption. */}
                {!col.reconcile && <div className="vi">{statusVi(col.status)}</div>}
                {selectableCards.length > 0 && selGroups.map((g) => {
                  const allSel = g.cards.length > 0 && g.cards.every((c) => sel.has(c.id))
                  const someSel = g.cards.some((c) => sel.has(c.id))
                  return (
                    <label className="colselall" key={g.key}>
                      <input
                        type="checkbox"
                        checked={allSel}
                        ref={(el) => {
                          if (el) el.indeterminate = someSel && !allSel
                        }}
                        onChange={() => toggleAll(g.cards)}
                      />
                      {g.key === 'general'
                        ? t('board.bulk.selectAll.general')
                        : g.key === 'handover'
                          ? t('board.bulk.selectAll.handover')
                          : t('board.bulk.selectAll.all')}
                    </label>
                  )
                })}
                {batchCards.length > 0 && (
                  <button type="button" className="colbatch" onClick={() => setBatchSend(batchCards)}>
                    {t('board.column.batchSendBtn')}
                  </button>
                )}
              </div>
              <div className="cb">
                {shown.length === 0 && (
                  <div className="emptycol">
                    {filterActive
                      ? t('board.column.noMatch')
                      : col.reconcile
                        ? t('board.column.reconcileEmpty')
                        : t('board.column.empty')}
                  </div>
                )}
                {shown.map((c) => (
                  <BoardCardView
                    key={c.id}
                    card={c}
                    busy={inFlight.has(c.id)}
                    onAction={(card, action) => void run(card, action)}
                    onSeize={(id) => void doSeize(id)}
                    selectable={canBulk && !col.reconcile && columnHasBulkAction(shown)}
                    selected={sel.has(c.id)}
                    onToggleSelect={toggleSel}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      )}
      {batchSend && (
        <BatchSendAccountingModal
          cards={batchSend}
          onClose={() => setBatchSend(null)}
          onDone={load}
        />
      )}
      <BoardActionModals
        handover={handover}
        sendAcc={sendAcc}
        receiveAcc={receiveAcc}
        ask={ask}
        setHandover={setHandover}
        setSendAcc={setSendAcc}
        setReceiveAcc={setReceiveAcc}
        setAsk={setAsk}
        doReceive={doReceive}
        doMissing={doMissing}
        doSendAcc={doSendAcc}
        doReceiveAcc={doReceiveAcc}
        onReload={load}
      />
    </section>
  )
}
