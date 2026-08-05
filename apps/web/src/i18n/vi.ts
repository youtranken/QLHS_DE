import { auth } from './vi/auth'
import { common } from './vi/common'
import { board } from './vi/board'
import { status } from './vi/status'
import { notificationKinds } from './vi/notifications'
import { tickets } from './vi/tickets'
import { dispatch } from './vi/dispatch'
import { closed } from './vi/closed'
import { bell } from './vi/bell'
import { shell } from './vi/shell'
import { assistant } from './vi/assistant'
import { adminShell } from './vi/admin/shell'
import { adminOverview } from './vi/admin/overview'
import { adminUsers } from './vi/admin/users'
import { adminOptions } from './vi/admin/options'
import { adminSla } from './vi/admin/sla'
import { adminAnalytics } from './vi/admin/analytics'
import { adminAudit } from './vi/admin/audit'
import { adminConfig } from './vi/admin/config'

/** The Vietnamese catalog. Grows one namespace per feature; en.ts later must
 *  satisfy MessagesShape (t.ts) so the compiler enforces completeness. */
export const vi = {
  auth,
  common,
  board,
  status,
  notificationKinds,
  tickets,
  dispatch,
  closed,
  bell,
  shell,
  assistant,
  adminShell,
  adminOverview,
  adminUsers,
  adminOptions,
  adminSla,
  adminAnalytics,
  adminAudit,
  adminConfig,
} as const
