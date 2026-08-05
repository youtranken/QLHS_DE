import { ALL_ROLES, ROLE, type Role } from '@qlhs/contracts'

/**
 * Every authenticated PMH ID user is at least an Applicant: submitting is the
 * baseline capability. DCC/Admin are *appointments* on top (Admin console),
 * never the reverse — so a user without any appointment defaults to Applicant,
 * and an appointed user keeps exactly their granted roles (no Applicant added).
 */
export function effectiveRoles(roles: readonly Role[]): Role[] {
  return roles.length === 0 ? [ROLE.Applicant] : [...roles]
}

/**
 * Pick the active role (H3): a remembered role if the user still holds it,
 * otherwise the first role in canonical order — but Admin (SA) owns zero
 * state-machine edges, so defaulting a multi-role user to it strands them unable
 * to act until they switch. Prefer any other actionable role; fall back to Admin
 * only when it is the user's sole role. Null when the user has no role.
 */
export function resolveActiveRole(
  roles: readonly Role[],
  remembered?: Role | null,
): Role | null {
  if (roles.length === 0) return null
  if (remembered && roles.includes(remembered)) return remembered
  const actionable = ALL_ROLES.find((r) => r !== ROLE.Admin && roles.includes(r))
  return actionable ?? ALL_ROLES.find((r) => roles.includes(r)) ?? null
}

export function canUseRole(roles: readonly Role[], role: Role): boolean {
  return roles.includes(role)
}

/**
 * Who may receive every ticket's change on the SSE firehose: staff (any DCC or
 * Admin appointment) work across all tickets, so they see all. A plain Applicant
 * only sees changes to their OWN tickets — the events controller filters those by
 * applicantSub, mirroring the detail-read scope so the stream can't leak the
 * existence/state of other applicants' tickets.
 */
export function canSeeAllTicketChanges(roles: readonly Role[]): boolean {
  return roles.some((r) => r !== ROLE.Applicant)
}
