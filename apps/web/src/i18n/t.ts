import { vi } from './vi'
import type { TicketStatus } from '@qlhs/contracts'

type Dict = typeof vi

// Dot-path union over nested string leaves ("tickets.myList.title" | ...).
// Record-typed namespaces (status, notificationKinds) collapse to `ns.${string}`;
// they are meant to be read via their dedicated lookups, not t().
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>
}[keyof T & string]
export type MessageKey = Paths<Dict>

/** Bell-feed notification kinds (2.2 status handoffs + 2.5 escalation ladder).
 *  A closed union — not every status raises a notification — pinned here so a
 *  catalog missing one key fails the build (kindMessage passes EN through on a
 *  runtime miss, but the type gap is what let an EN key silently vanish). */
export type NotificationKind =
  | Extract<
      TicketStatus,
      'Completed' | 'Returned' | 'Submitted' | 'Submitted to DCC2' | 'Submitted to DCC2 (Hardcopy)' | 'Submitted to DCC3'
    >
  | 'EscalateWarn'
  | 'EscalateOverdue'
  | 'EscalateCritical'

/** Deep same-shape-with-string-leaves — what en.ts must implement. The two
 *  lookup namespaces are pinned to their canonical key unions (status → every
 *  TicketStatus, notificationKinds → NotificationKind): the key-for-key contract
 *  the catalogs must meet. Bites per-key once a catalog exposes its literal keys
 *  (`satisfies Record<…>`); a catalog still annotated `: Record<string,string>`
 *  hides its keys, so its completeness rides on the parity this pins the shape to. */
export type MessagesShape = Omit<DeepShape<Dict>, 'status' | 'notificationKinds'> & {
  status: Record<TicketStatus, string>
  notificationKinds: Record<NotificationKind, string>
}
type DeepShape<T> = T extends string ? string : { [K in keyof T]: DeepShape<T[K]> }

let dict: MessagesShape = vi
let tag = 'vi-VN'

/** Future language switch: setLocale(en, 'en-US') + re-render from the root.
 *  Components never change — t() reads the module-level dict at render time. */
export function setLocale(d: MessagesShape, localeTag: string): void {
  dict = d
  tag = localeTag
}
export const localeTag = (): string => tag

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const raw = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict)
  const s = typeof raw === 'string' ? raw : key // runtime fallback; TS prevents this path
  return params ? s.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? `{${p}}`)) : s
}

/** AD-13 seam: canonical EN status → VI presentation label (EN key passthrough). */
export const statusVi = (status: string): string =>
  (dict.status as Record<string, string>)[status] ?? status

/** Notification kind → one-liner (kind passthrough when unmapped). */
export const kindMessage = (kind: string): string =>
  (dict.notificationKinds as Record<string, string>)[kind] ?? kind
