/**
 * Group gate (AD-7 stays sub-based; groups are only an access filter). Pure —
 * no framework/IO. Case-insensitive because PMH ID group names and the admin's
 * allow-list are typed by humans and casing drifts.
 */
export function intersectsCI(userGroups: string[] | undefined, allowed: string[]): boolean {
  if (!userGroups?.length || !allowed.length) return false
  const allow = new Set(allowed.map((g) => g.toLowerCase()))
  return userGroups.some((g) => allow.has(g.toLowerCase()))
}

/**
 * The login-time verdict. An EMPTY allow-list means the gate is OFF (fail-open):
 * QLHS relies on PMH ID's own per-client group grant until an operator opts in
 * via QLHS_ALLOWED_GROUPS. A non-empty list blocks anyone outside it.
 */
export function isGroupAllowed(userGroups: string[] | undefined, allowed: string[]): boolean {
  if (allowed.length === 0) return true
  return intersectsCI(userGroups, allowed)
}
