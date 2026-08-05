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

/** Configured VP display name (Admin › Cấu hình › Tên VP). Defaults to "Andy" —
 *  the same token baked into the canonical status "Submitted to VP Andy", so an
 *  unset config leaves every label byte-identical. Set once at startup from
 *  GET /config; substituted into any display string via applyVp(). */
let vpName = 'Andy'
export const setVpName = (name: string): void => {
  if (name.trim()) vpName = name.trim()
}
export const getVpName = (): string => vpName

/** Presentation-only VP-name substitution. Rewrites both the {vp} placeholder
 *  (i18n strings) and the literal canonical token "Andy" (raw status strings
 *  shown at tab/chip/metro/rail per AD-13). No-op while vpName is "Andy".
 *  Uses function replacers so a name with `$` (e.g. `A$&`) inserts literally
 *  instead of triggering String.replace's $-substitution. */
export const applyVp = (s: string): string =>
  s.replace(/\{vp\}/g, () => vpName).replace(/\bAndy\b/g, () => vpName)

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
  // Substitute the VP name in the STATIC template only, BEFORE interpolating
  // params — a param carrying user data (a person named "…Andy", a free-text
  // reason) must stay itself, not get rewritten to the VP name.
  const base = applyVp(s)
  return params ? base.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? `{${p}}`)) : base
}

/** AD-13 seam: canonical EN status → VI presentation label (EN key passthrough).
 *  applyVp() rewrites the VP name in both the label and the EN passthrough. */
export const statusVi = (status: string): string =>
  applyVp((dict.status as Record<string, string>)[status] ?? status)

/** Notification kind → one-liner (kind passthrough when unmapped). applyVp keeps
 *  it consistent with statusVi should a future kind carry the VP name. */
export const kindMessage = (kind: string): string =>
  applyVp((dict.notificationKinds as Record<string, string>)[kind] ?? kind)
