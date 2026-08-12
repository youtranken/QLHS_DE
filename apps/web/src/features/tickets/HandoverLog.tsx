import { Fragment, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { SYSTEM_SUB } from '@qlhs/contracts'
import { displaySub } from '../../shared/format'
import type { LogRow } from './detailLog'
import { t } from '../../i18n'

/** Human verb for an immutable-log line; built per render so a locale switch re-evaluates. */
function actionVi(): Record<string, string> {
  return {
    created: t('tickets.log.created'), submit: t('tickets.log.submit'),
    pool_picked: t('tickets.log.poolPicked'), pick: t('tickets.log.pick'), confirm: t('tickets.log.confirm'),
    submitToAndy: t('tickets.log.submitToAndy'), sendToVpAndy: t('tickets.log.sendToVpAndy'),
    andyApproveComplete: t('tickets.log.andyApproveComplete'),
    andyRequireBop: t('tickets.log.andyRequireBop'),
    handoverToDcc2: t('tickets.log.handoverToDcc2'), handoverToDcc3: t('tickets.log.handoverToDcc3'),
    sendToDcc2: t('tickets.log.sendToDcc2'), sendToDcc3: t('tickets.log.sendToDcc3'),
    confirmReceivedByDcc2: t('tickets.log.confirmReceivedByDcc2'),
    confirmReceivedByDcc3: t('tickets.log.confirmReceivedByDcc3'),
    sendToAccounting: t('tickets.log.sendToAccounting'), receiveFromAcc: t('tickets.log.receiveFromAcc'),
    submitToBop: t('tickets.log.submitToBop'), sendToBop: t('tickets.log.sendToBop'),
    bopApprove: t('tickets.log.bopApprove'),
    completeContract: t('tickets.log.completeContract'), complete: t('tickets.log.complete'),
    sendBack: t('tickets.log.sendBack'), auto_return: t('tickets.log.autoReturn'),
    confirmReturnReceipt: t('tickets.log.confirmReturnReceipt'),
    resubmit: t('tickets.log.resubmit'),
    reopen: t('tickets.log.reopen'), reopen_requested: t('tickets.log.reopenRequested'),
    return_requested: t('tickets.log.returnRequested'),
    missing_paper_flagged: t('tickets.log.missingPaperFlagged'),
    missing_paper_cleared: t('tickets.log.missingPaperCleared'),
    priority_changed: t('tickets.log.priorityChanged'),
    field_changed: t('tickets.log.fieldChanged'),
    lock_seized: t('tickets.log.lockSeized'), undo: t('tickets.log.undo'),
    cancel: t('tickets.log.cancel'),
  }
}

/** Returns whose reason the reviewer most needs to read — highlighted in the log. */
const RETURN_ACTIONS: ReadonlySet<string> = new Set(['sendBack', 'auto_return'])

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('vi-VN') : '—'
}

/** Which processing round a row belongs to. Events carry it; a pause/resume takes
 *  the round in effect when it happened (the latest event at-or-before its time). */
function roundOf(row: LogRow, events: ReadonlyArray<Extract<LogRow, { kind: 'event' }>>): number {
  if (row.kind === 'event') return row.entry.roundNo
  let round = 0
  for (const e of events) if (e.at <= row.at) round = Math.max(round, e.entry.roundNo)
  return round
}

/**
 * Handover log (NHẬT KÝ BÀN GIAO). A single-round ticket renders flat. Once a ticket
 * has been through more than one round, only the LATEST round stays open; each older
 * round (Round 0, 1, 2 …) collapses behind a toggle so the current activity isn't
 * buried under old rounds. SLA pauses are already woven into `log` (mergeLog).
 */
export function HandoverLog({ log, directory }: { log: LogRow[]; directory: Record<string, string> }) {
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set())
  const ACTION_VI = actionVi()
  const events = log.filter((r): r is Extract<LogRow, { kind: 'event' }> => r.kind === 'event')

  // Group rows by round, preserving the newest-first order within each round.
  const byRound = new Map<number, LogRow[]>()
  for (const r of log) {
    const rd = roundOf(r, events)
    const arr = byRound.get(rd)
    if (arr) arr.push(r)
    else byRound.set(rd, [r])
  }
  const rounds = [...byRound.keys()].sort((a, b) => b - a) // newest round first
  const latest = rounds[0] ?? 0

  const toggle = (rd: number) =>
    setOpen((prev) => {
      const n = new Set(prev)
      n.has(rd) ? n.delete(rd) : n.add(rd)
      return n
    })

  const renderRow = (row: LogRow, i: number) => (
    <div className={row.kind === 'event' ? 'li' : 'li pauseli'} key={i}>
      <span className="dt">{fmt(row.at)}</span>
      <span className="tx">
        {row.kind === 'event' ? (
          <>
            <b>
              {row.entry.actorSub === SYSTEM_SUB
                ? t('tickets.detail.logSystemActor')
                : displaySub(row.entry.actorSub, directory)}
            </b>{' '}
            {ACTION_VI[row.entry.action] ?? row.entry.action}
            {row.entry.action === 'reopen' && (
              <span className="newround">{t('tickets.detail.logNewRound')}</span>
            )}
            {row.entry.reason &&
              (RETURN_ACTIONS.has(row.entry.action) ? (
                <span className="logreason">
                  <b>{t('tickets.detail.logReturnReasonLabel')}</b> {row.entry.reason}
                </span>
              ) : (
                <span className="logcomment">
                  <b>{t('tickets.detail.logCommentLabel')}</b> {row.entry.reason}
                </span>
              ))}
          </>
        ) : row.kind === 'pause' ? (
          <>
            {t('tickets.detail.logPausePrefix')}
            <b>{displaySub(row.pause.pausedBySub, directory)}</b>
            {t('tickets.detail.logPauseSuffix', { reason: row.pause.reason })}
          </>
        ) : (
          <>{t('tickets.detail.logResume')}</>
        )}
      </span>
    </div>
  )

  return (
    <div className="blk log flush">
      <h3>{t('tickets.detail.sectionLog')}</h3>
      {log.length === 0 && <p className="logempty">{t('tickets.detail.logEmpty')}</p>}
      {rounds.map((rd) => {
        const rows = byRound.get(rd) ?? []
        // Latest round is always open; older rounds toggle (default collapsed).
        if (rd === latest) return <Fragment key={rd}>{rows.map(renderRow)}</Fragment>
        const isOpen = open.has(rd)
        return (
          <div className="loground" key={rd}>
            <button
              type="button"
              className={`logroundtoggle${isOpen ? ' on' : ''}`}
              aria-expanded={isOpen}
              onClick={() => toggle(rd)}
            >
              <ChevronRight size={13} aria-hidden className="chev" />
              {t('tickets.detail.logRoundBtn', { n: rd })}
            </button>
            {isOpen && rows.map(renderRow)}
          </div>
        )
      })}
    </div>
  )
}
