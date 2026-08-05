/** 2.2 — the English one-liner for each notification kind (the canonical
 *  English status is stored; presentation only, AD-13). Looked up via
 *  kindMessage(), never t(). */
export const notificationKinds = {
  Completed: 'Ticket completed',
  Returned: 'Ticket returned — needs amendment',
  Submitted: 'New ticket in Pool, awaiting pickup',
  'Submitted to DCC2': 'Ticket handed over to DCC2',
  'Submitted to DCC2 (Hardcopy)': 'Hardcopy handed over to DCC2',
  'Submitted to DCC3': 'Ticket handed over to DCC3',
  // 2.5 escalation ladder
  EscalateWarn: 'Ticket nearing SLA — act soon',
  EscalateOverdue: 'Ticket past SLA — needs an owner',
  EscalateCritical: 'Ticket badly overdue — admin notified',
} satisfies Record<string, string>
