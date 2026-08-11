import { useCallback, useRef, useState } from 'react'
import { SYSTEM_SUB, TICKET_STATUS } from '@qlhs/contracts'
import { useLiveRefetch } from '../../shared/useLiveRefetch'
import { getTicketDetail, type TicketDetail as Detail, type TimelineEntry } from './api'
import { statusVi } from './statusLabel'
import { groupAmount, displaySub } from '../../shared/format'
import { goBack } from '../../shared/route'
import { mergeLog } from './detailLog'
import { ReturnPanel } from './ReturnPanel'
import { SubmittedEditForm } from './SubmittedEditForm'
import { RETURN_STATES } from './ticketStates'
import { StateNotice } from '../../shared/StateNotice'
import { applyVp, t } from '../../i18n'


/** Human verb for an immutable-log line; falls back to the raw event name.
 *  A function (not a module const) so a future locale switch re-evaluates. */
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

/** A "Submitted to X" current status means handed over but NOT yet received/acted
 *  on — tell the applicant WHO they're waiting on. Null for self-explanatory states. */
function waitingHint(status: string): string | null {
  switch (status) {
    case TICKET_STATUS.SubmittedToVpAndy:
      return t('tickets.routeRail.waiting.andy')
    case TICKET_STATUS.SubmittedToDcc2:
    case TICKET_STATUS.SubmittedToDcc2Hardcopy:
      return t('tickets.routeRail.waiting.dcc2')
    case TICKET_STATUS.SubmittedToDcc3:
      return t('tickets.routeRail.waiting.dcc3')
    case TICKET_STATUS.SubmittedToAccounting:
      return t('tickets.routeRail.waiting.acc')
    case TICKET_STATUS.SubmittedToBop:
      return t('tickets.routeRail.waiting.bop')
    default:
      return null
  }
}

export function TicketDetail({ ticketId, embedded = false }: { ticketId: string; embedded?: boolean }) {
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  // Don't let a live refetch yank the form out from under an in-progress edit.
  const editingRef = useRef(false)
  editingRef.current = editing

  const load = useCallback(async () => {
    // Clear a prior error first, or a successful Retry would keep rendering the
    // error screen (the `if (error)` gate below returns before the fresh data).
    setError(null)
    try {
      setD(await getTicketDetail(ticketId))
    } catch {
      setError(t('tickets.detail.errLoad'))
    }
  }, [ticketId])

  // Live-refresh so an open detail reflects a Return/handover the moment it lands,
  // instead of showing a stale snapshot until the user navigates away (UX M4).
  useLiveRefetch(() => {
    if (!editingRef.current) void load()
  }, [ticketId])

  if (error) {
    return (
      <div>
        {!embedded && (
          <div className="closedhead">
            <button type="button" className="backchip" onClick={goBack} aria-label={t('tickets.detail.backBtn')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>
        )}
        <StateNotice kind="error" text={error} onRetry={() => void load()} />
      </div>
    )
  }
  if (!d) return <StateNotice kind="loading" text={t('tickets.detail.loading')} />

  // Use the server-resolved flow (authoritative, incl. admin-added document types),
  // not a hardcoded doc-type map — else new types fall through to General and the
  // Contract No / Payment No fields would be mislabeled/hidden.
  const flow = d.flow
  const code = d.code ?? d.id.slice(0, 8)
  const log = mergeLog(d.timeline, d.pauses)
  const ACTION_VI = actionVi()
  // Built per render (not module-level) so a future locale switch re-evaluates.
  // "Contract No" vs "Payment No" depends on the flow (business rule):
  //  • Payment: the Applicant's contractNo IS the real, required contract number
  //    ("Contract No"); the DCC3-entered documentNo is a separate "Payment No".
  //  • Contract: the Applicant usually leaves contractNo = N/A — the real Contract No
  //    is the documentNo DCC2 assigns at send-to-Accounting (fall back to the
  //    Applicant value until DCC fills it).
  //  • General: just the Applicant's contractNo.
  const numberFields: Array<[keyof Detail, string, boolean]> =
    flow === 'Payment'
      ? [
          ['contractNo', t('tickets.detail.fieldContractNo'), true],
          ...(d.documentNo
            ? [['documentNo', t('tickets.detail.fieldPaymentNo'), true] as [keyof Detail, string, boolean]]
            : []),
        ]
      : flow === 'Contract'
        ? [[d.documentNo ? 'documentNo' : 'contractNo', t('tickets.detail.fieldContractNoAcc'), true]]
        : [['contractNo', t('tickets.detail.fieldContractNo'), true]]

  // Same order as the create form (Subject → Document Type → Contractor → Contract
  // No → Project/Team → Amount → Payment Term → Budget code) so the detail reads
  // like what the Applicant filled in. Split around the special Amount block.
  const FIELDS_BEFORE_AMOUNT: Array<[keyof Detail, string, boolean]> = [
    ['documentType', t('tickets.detail.fieldDocumentType'), false],
    ['contractor', t('tickets.detail.fieldContractor'), false],
    ...numberFields,
    ['projectTeam', t('tickets.detail.fieldProjectTeam'), false],
  ]
  const FIELDS_AFTER_AMOUNT: Array<[keyof Detail, string, boolean]> = [
    ['paymentTerm', t('tickets.detail.fieldPaymentTerm'), false],
    ['budgetCode', t('tickets.detail.fieldBudgetCode'), true],
  ]

  return (
    <section aria-label={t('tickets.detail.srTitle', { code })}>
      {embedded ? (
        <h1 className="sr-only">{t('tickets.detail.srTitle', { code })}</h1>
      ) : (
        <div className="closedhead">
          <button type="button" className="backchip" onClick={goBack} aria-label={t('tickets.detail.backBtn')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          {/* Tiêu đề KHÔNG kèm mã — mã đã nổi trong thẻ dcard ngay dưới (tránh trùng). */}
          <h1>{t('tickets.detail.modalTitle')}</h1>
        </div>
      )}
      {RETURN_STATES.has(d.status) && <ReturnPanel detail={d} onDone={() => void load()} />}
      {d.status === 'Submitted' &&
        (editing ? (
          <SubmittedEditForm
            detail={d}
            onDone={() => {
              setEditing(false)
              void load()
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="editbar">
            <button type="button" className="btn primary" onClick={() => setEditing(true)}>
              {t('tickets.detail.editBtn')}
            </button>
            <span className="hint">{t('tickets.detail.editHint')}</span>
          </div>
        ))}
      {!editing && (
      <div className="dcard">
        <div className="dhead">
          {d.code ? (
            <span className="clg">{d.code}</span>
          ) : (
            <span className="clg nocode">{t('tickets.detail.noCode')}</span>
          )}
          <span className="plg">{d.contractor ?? '—'}</span>
          <span className="flowbadge" lang="en">
            {flow}
          </span>
          <span className={`chip${d.status === 'Completed' ? ' done' : ''}`}>
            <span className="dot" aria-hidden />
            <span lang="en">{applyVp(d.status)}</span>
            <small className="chipvi">· {statusVi(d.status)}</small>
          </span>
          {d.overdueDays > 0 && (
            <span
              className={d.paused ? 'sla held' : 'sla'}
              aria-label={
                d.paused
                  ? t('tickets.detail.overduePausedAria', { n: d.overdueDays })
                  : t('tickets.detail.overdueAria', { n: d.overdueDays })
              }
            >
              {t('tickets.detail.overdueBadge', { n: d.overdueDays })}
            </span>
          )}
          {d.paused && (
            <span className="pausetag" title={d.pauseReason ?? undefined}>
              {t('tickets.detail.pausedTag')}
              {d.pauseReason ? t('tickets.detail.pausedReasonSuffix', { reason: d.pauseReason }) : ''}
            </span>
          )}
        </div>

        <div className="dbody">
          <div className="dleft">
            <div className="blk">
              <h3>{t('tickets.detail.sectionData')}</h3>
              <div className="fgrid">
                <div className="f wide">
                  <div className="k">{t('tickets.detail.fieldDescription')}</div>
                  <div className="v full">{d.description || '—'}</div>
                </div>
                {FIELDS_BEFORE_AMOUNT.map(([k, label, mono]) => (
                  <div className="f" key={k}>
                    <div className="k">{label}</div>
                    <div className={`v${mono ? ' mono' : ''}`}>{(d[k] as string) || '—'}</div>
                  </div>
                ))}
                <div className="f">
                  <div className="k">{t('tickets.detail.fieldAmount')}</div>
                  <div className="v mono">
                    {groupAmount(d.amount, d.currency ?? 'VND')} {d.currency}
                  </div>
                </div>
                {FIELDS_AFTER_AMOUNT.map(([k, label, mono]) => (
                  <div className="f" key={k}>
                    <div className="k">{label}</div>
                    <div className={`v${mono ? ' mono' : ''}`}>{(d[k] as string) || '—'}</div>
                  </div>
                ))}
                <div className="f">
                  <div className="k">{t('tickets.detail.fieldRound')}</div>
                  <div className="v mono">{d.roundNo}</div>
                </div>
              </div>
            </div>

            <div className="tl blk flush">
              <h3>{t('tickets.detail.sectionRoute')}</h3>
              <ol>
                {d.route.map((s, i) => (
                  <li key={i} className={`st ${s.phase}`}>
                    <span className="nd" aria-hidden />
                    <div className="nm">
                      <span lang="en">{applyVp(s.status)}</span>
                      <span className="vi">{statusVi(s.status)}</span>
                      {s.phase === 'now' && <span className="here">{t('tickets.routeRail.here')}</span>}
                      {s.phase === 'now' && waitingHint(s.status) && (
                        <span className="waitfor">{waitingHint(s.status)}</span>
                      )}
                    </div>
                    {s.holder && (
                      <div className="hold">
                        <span className="hn">{displaySub(s.holder, d.directory)}</span>
                      </div>
                    )}
                    <div className="tm">{s.phase === 'next' ? '' : fmt(s.enteredAt)}</div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="dright">
            <div className="blk">
              <h3>{t('tickets.detail.sectionSummary')}</h3>
              <div className="kv">
                <span className="k">{t('tickets.detail.kvStatus')}</span>
                <span className="v" lang="en">
                  {applyVp(d.status)}
                </span>
              </div>
              <div className="kv">
                <span className="k">{t('tickets.detail.kvDwell')}</span>
                <span className="v mono">{t('common.time.days', { n: d.dwellDays })}</span>
              </div>
              <div className="kv">
                <span className="k">{t('tickets.detail.kvSla')}</span>
                <span className={`v mono${d.overdueDays > 0 ? ' warn' : ''}`}>
                  {d.overdueDays > 0 ? t('tickets.detail.slaOver', { n: d.overdueDays }) : t('tickets.detail.slaOk')}
                </span>
              </div>
              <div className="kv">
                <span className="k">{t('tickets.detail.kvRound')}</span>
                <span className="v mono">{d.roundNo}</span>
              </div>
            </div>

            <div className="blk log flush">
              <h3>{t('tickets.detail.sectionLog')}</h3>
              {log.length === 0 && <p className="logempty">{t('tickets.detail.logEmpty')}</p>}
              {log.map((row, i) => (
                <div className={row.kind === 'event' ? 'li' : 'li pauseli'} key={i}>
                  <span className="dt">{fmt(row.at)}</span>
                  <span className="tx">
                    {row.kind === 'event' ? (
                      <>
                        <b>
                          {row.entry.actorSub === SYSTEM_SUB
                            ? t('tickets.detail.logSystemActor')
                            : displaySub(row.entry.actorSub, d.directory)}
                        </b>{' '}
                        {ACTION_VI[row.entry.action] ?? row.entry.action}
                        {row.entry.action === 'reopen' && (
                          <span className="newround">{t('tickets.detail.logNewRound')}</span>
                        )}
                        {row.entry.reason &&
                          (RETURN_ACTIONS.has(row.entry.action) ? (
                            <span className="logreason">
                              <b>{t('tickets.detail.logReturnReasonLabel')}</b>{' '}
                              {row.entry.reason}
                            </span>
                          ) : (
                            // Any other typed note (DCC "missing paper" report, the DCC1
                            // note to BOP, …) is highlighted too so it doesn't get lost.
                            <span className="logcomment">
                              <b>{t('tickets.detail.logCommentLabel')}</b>{' '}
                              {row.entry.reason}
                            </span>
                          ))}
                      </>
                    ) : row.kind === 'pause' ? (
                      <>
                        {t('tickets.detail.logPausePrefix')}
                        <b>{displaySub(row.pause.pausedBySub, d.directory)}</b>
                        {t('tickets.detail.logPauseSuffix', { reason: row.pause.reason })}
                      </>
                    ) : (
                      <>{t('tickets.detail.logResume')}</>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </section>
  )
}
