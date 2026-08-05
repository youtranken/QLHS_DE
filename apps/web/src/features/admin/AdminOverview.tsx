import { useCallback, useEffect, useState } from 'react'
import { t } from '../../i18n'
import { StateNotice } from '../../shared/StateNotice'
import type { AdminSection } from './AdminShell'
import { getAdminOverview, type AdminOverview as Overview } from './api'

/** Tổng quan quản trị (SPEC 15-admin-overview). Trang chỉ-đọc, mọi số DERIVE ở
 *  read (AD-6) qua `GET /api/admin/overview` — không bảng mới (story N1). */

const FLOW_META: Record<string, { key: string; name: string; cls: string }> = {
  General: { key: 'a', name: 'General', cls: 'general' },
  Contract: { key: 'b', name: 'Contract-Budget', cls: 'contract' },
  Payment: { key: 'c', name: 'Payment', cls: 'payment' },
}

function toneOf(action: string): 'acc' | 'ok' | 'bad' | undefined {
  if (/^handover|^sendToAccounting|^submitTo|^confirmReceived/.test(action)) return 'acc'
  if (action === 'created') return 'ok'
  if (action === 'sendBack' || action === 'reopen') return 'bad'
  return undefined
}

function hhmm(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
)
const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

interface Task {
  to: AdminSection
  warn?: boolean
  title: string
  sub: string
}

function deriveTasks(o: Overview): Task[] {
  const tasks: Task[] = []
  if (o.overdueTotal > 0) {
    const per = o.lines
      .filter((l) => l.overdue > 0)
      .map((l) => t('adminOverview.overdueBreak', { n: l.overdue, flow: FLOW_META[l.flow]?.name ?? l.flow }))
      .join(' · ')
    tasks.push({
      to: 'sla',
      warn: true,
      title: t('adminOverview.tasks.overdueTitle', { n: o.overdueTotal }),
      sub: per || t('adminOverview.tasks.overdueFallbackSub'),
    })
  }
  // F8: a stopped clock hides a ticket from the overdue count, so it must never be
  // invisible here — otherwise pause quietly becomes the way to make SLA look good.
  if (o.pausedTotal > 0) {
    tasks.push({
      to: 'pause',
      title: t('adminOverview.tasks.pausedTitle', { n: o.pausedTotal }),
      sub: t('adminOverview.tasks.pausedSub'),
    })
  }
  if (o.mailPending > 0) {
    tasks.push({ to: 'audit', title: t('adminOverview.mailPending', { n: o.mailPending }), sub: t('adminOverview.tasks.mailSub') })
  }
  tasks.push({ to: 'audit', title: t('adminOverview.tasks.auditTitle'), sub: t('adminOverview.tasks.auditSub', { n: o.auditToday }) })
  return tasks
}

export function AdminOverview({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const [o, setO] = useState<Overview | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setError(false)
    getAdminOverview()
      .then(setO)
      .catch(() => setError(true))
  }, [])
  useEffect(() => load(), [load])

  const lines = o
    ? [...o.lines].sort((a, b) => (FLOW_META[a.flow]?.key ?? 'z').localeCompare(FLOW_META[b.flow]?.key ?? 'z'))
    : []
  const tasks = o ? deriveTasks(o) : []
  const overBreak = o
    ? o.lines
        .filter((l) => l.overdue > 0)
        .map((l) => t('adminOverview.overdueBreak', { n: l.overdue, flow: FLOW_META[l.flow]?.name ?? l.flow }))
        .join(' · ')
    : ''

  return (
    <section aria-label={t('adminOverview.title')}>
      <h1 className="sr-only">{t('adminOverview.title')}</h1>
      {error && <StateNotice kind="error" text={t('adminOverview.loadError')} onRetry={load} />}
      {!error && !o && <StateNotice kind="loading" text={t('adminOverview.loading')} />}

      {o && (
      <div className="ovgrid">
        <div className="ovmain">
          <div className="kpis reveal d1">
            <button type="button" className="kpi" onClick={() => onNavigate('roles')} aria-label={t('adminOverview.kpis.usersAria')}>
              <span className="lbl">{t('adminOverview.kpis.users')}</span>
              <span className="val" style={{ display: 'block' }}>{o.users.total}</span>
              <span className="sub2">{t('adminOverview.kpis.usersSub', { n: o.users.appointed })}</span>
            </button>
            <div className="kpi">
              <div className="lbl">{t('adminOverview.kpis.running')}</div>
              <div className="val">{o.runningTotal}</div>
              <div className="sub2">{t('adminOverview.kpis.runningSub')}</div>
            </div>
            <div className={o.overdueTotal > 0 ? 'kpi hot' : 'kpi'}>
              <div className="lbl">{t('adminOverview.kpis.overdue')}</div>
              <div className="val">{o.overdueTotal}</div>
              <div className="sub2">{overBreak || t('adminOverview.kpis.overdueNone')}</div>
            </div>
            <div className="kpi">
              <div className="lbl">{t('adminOverview.kpis.auditToday')}</div>
              <div className="val">{o.auditToday}</div>
            </div>
          </div>

          <section className="panel reveal d2" aria-label={t('adminOverview.lines.title')}>
            <div className="panel-hd"><h2>{t('adminOverview.lines.title')}</h2></div>
            <div className="panel-bd" style={{ paddingTop: 6, paddingBottom: 8 }}>
              {lines.map((l) => {
                const m = FLOW_META[l.flow] ?? { key: 'z', name: l.flow, cls: 'general' }
                const over = l.overdue > 0
                // 0 hồ sơ đang chạy → không có gì để "đúng hạn"; để thanh rỗng +
                // ẩn nhãn %/ổn thay vì hiện thanh màu 100% gây hiểu nhầm.
                const idle = l.running === 0
                return (
                  <div className="lrow" key={l.flow}>
                    <span className={`lbadge ${m.key}`} aria-hidden>{m.key.toUpperCase()}</span>
                    <span className="t">
                      <span className="nm">{m.name}</span>
                      <span className="ct">{t('adminOverview.lines.running', { n: l.running })}</span>
                    </span>
                    <span
                      className={`rail fl-${m.cls}${idle ? ' idle' : ''}`}
                      role="img"
                      aria-label={
                        idle
                          ? `${m.name} · ${t('adminOverview.lines.running', { n: 0 })}`
                          : t('adminOverview.lines.railAria', { flow: m.name, pct: l.onTimePct }) +
                            (over ? t('adminOverview.lines.railAriaOverdue', { n: l.overdue }) : '')
                      }
                    >
                      <span className="fill" style={{ width: `${idle ? 0 : l.onTimePct}%` }} />
                    </span>
                    <span className={over ? 'pct ov' : idle ? 'pct idle' : 'pct'}>
                      {idle ? '—' : t('adminOverview.lines.onTimePct', { pct: l.onTimePct })}
                    </span>
                    {over ? (
                      <span className="oflag">{t('adminOverview.lines.overdueFlag', { n: l.overdue })}</span>
                    ) : idle ? null : (
                      <span className="okflag">{t('adminOverview.lines.okFlag')}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="panel reveal d3" aria-label={t('adminOverview.recent.title')} style={{ marginTop: 16 }}>
            <div className="panel-hd"><h2>{t('adminOverview.recent.title')}</h2></div>
            <div className="panel-bd" style={{ paddingTop: 8 }}>
              {o.recent.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '4px 2px' }}>{t('adminOverview.recent.empty')}</p>
              )}
              {o.recent.map((a) => {
                const tone = toneOf(a.action)
                return (
                  <div className="act" key={a.ticketId + a.occurredAt}>
                    <span className="tm">{hhmm(a.occurredAt)}</span>
                    <span className="who">{a.actorName}</span>
                    <span className={tone ? `evchip ${tone}` : 'evchip'} lang="en">{a.action}</span>
                    <span className="code">{a.code ?? a.ticketId.slice(0, 8)}</span>
                  </div>
                )
              })}
              <div className="actft">
                <button type="button" className="btn ghost" onClick={() => onNavigate('audit')}>
                  {t('adminOverview.recent.viewAll')}
                  <ArrowRight />
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="ovside">
          <div className="scard reveal d2" aria-label={t('adminOverview.tasks.title')}>
            <h3>{t('adminOverview.tasks.title')} <span className="n">{tasks.length}</span></h3>
            <div className="tasks">
              {tasks.map((task) => (
                <button type="button" className={task.warn ? 'task warn' : 'task'} key={task.title} onClick={() => onNavigate(task.to)}>
                  <span>
                    <span className="tt">{task.title}</span>
                    <span className="ts">{task.sub}</span>
                  </span>
                  <span className="go"><ChevronRight /></span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
      )}
    </section>
  )
}
