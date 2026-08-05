/** Admin overview: KPIs, line health, recent activity, to-do card. */
export const adminOverview = {
  title: 'Admin overview',
  loadError: 'Could not load overview — try again later.',
  loading: 'Loading overview…',
  // Shared by the overdue KPI breakdown and the overdue to-do line.
  overdueBreak: '▲{n} {flow}',
  mailPending: '{n} emails pending',
  tasks: {
    title: 'To do',
    overdueTitle: '{n} tickets past SLA',
    overdueFallbackSub: 'check SLA thresholds',
    pausedTitle: '{n} tickets with SLA clock paused',
    pausedSub: 'view reason · who paused · how long',
    mailSub: 'notification queue',
    auditTitle: 'View system audit log',
    auditSub: '{n} events today',
  },
  kpis: {
    usersAria: 'Users — open role admin',
    users: 'Users',
    usersSub: '{n} hold a DCC/Admin role',
    running: 'Running tickets',
    runningSub: 'across all 3 flows',
    overdue: 'Past SLA today',
    overdueNone: 'no overdue tickets',
    auditToday: 'Audit events today',
  },
  lines: {
    title: 'Ticket flows',
    running: '{n} running tickets',
    railAria: '{flow} {pct}% on time',
    railAriaOverdue: ', {n} overdue',
    onTimePct: '{pct}% on time',
    overdueFlag: '▲{n}',
    okFlag: 'ok',
  },
  recent: {
    title: 'Recent activity',
    empty: 'No events yet.',
    viewAll: 'View full audit log',
  },
} as const
