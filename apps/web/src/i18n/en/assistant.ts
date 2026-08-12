/** Internal assistant (AssistantPanel) — client-owned chrome/chips/errors/labels.
 *  Server block TEXT is a backend concern, not here. `starters.*` are display
 *  LABELS only; the query strings (Chip.text) stay Vietnamese because the no-LLM
 *  intent engine only parses Vietnamese — translating them would break matching. */
export const assistant = {
  name: 'QLHS Assistant',
  online: 'Online',
  clearChat: 'Clear chat',
  close: 'Close',
  looking: 'Looking up',
  placeholder: 'Type a question…',
  questionLabel: 'Question',
  send: 'Send',
  welcome:
    'Hi {who} 👋 I’m the QLHS assistant. Ask naturally (e.g. “my open tickets”, “details G-2026-0001”) or pick a shortcut below.',
  welcomeYou: 'there',
  error: 'Something went wrong looking that up — please try again.',
  starters: {
    adminOverview: 'System overview',
    adminStats: 'Statistics',
    adminPaused: 'SLA paused',
    dccMine: 'My work',
    dccMap: 'Route map',
    unread: 'Unread notifications',
    myTickets: 'My tickets',
    myOpen: 'My open tickets',
  },
  card: {
    thCode: 'Code',
    thFlow: 'Document Type',
    thStatus: 'Status',
    thType: 'Type',
    nextStep: 'Next step for',
    late: '{n}d late',
    onTime: 'on time',
    paused: 'paused',
    closed: 'closed',
  },
} as const
