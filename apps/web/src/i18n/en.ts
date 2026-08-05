import type { MessagesShape } from './t'
import { auth } from './en/auth'
import { common } from './en/common'
import { board } from './en/board'
import { status } from './en/status'
import { notificationKinds } from './en/notifications'
import { tickets } from './en/tickets'
import { dispatch } from './en/dispatch'
import { closed } from './en/closed'
import { bell } from './en/bell'
import { shell } from './en/shell'
import { assistant } from './en/assistant'
import { adminShell } from './en/admin/shell'
import { adminOverview } from './en/admin/overview'
import { adminUsers } from './en/admin/users'
import { adminOptions } from './en/admin/options'
import { adminSla } from './en/admin/sla'
import { adminAnalytics } from './en/admin/analytics'
import { adminAudit } from './en/admin/audit'
import { adminConfig } from './en/admin/config'

/** The English catalog. Typed as MessagesShape so the compiler enforces that it
 *  matches the Vietnamese source key-for-key (missing/extra keys fail the build). */
export const en: MessagesShape = {
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
}
