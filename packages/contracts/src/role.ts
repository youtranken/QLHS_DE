/**
 * Internal system roles. Identity comes from PMH ID SSO (`sub`); the QLHS role
 * is assigned LOCALLY by an Admin (stored in user_role) — PMH groups only gate
 * who may reach the app. (Supersedes the earlier group→role mapping.)
 *
 * Andy / ACC / BOP are EXTERNAL actors (they never log into QLHS); a DCC enters
 * their outcome on their behalf, so they are not system roles.
 */
export const ROLE = {
  /** Local super-admin (SA). Assigns QLHS roles to SSO-authenticated users. */
  Admin: 'Admin',
  Applicant: 'Applicant',
  Dcc1: 'DCC1',
  Dcc2: 'DCC2',
  Dcc3: 'DCC3',
} as const

export type Role = (typeof ROLE)[keyof typeof ROLE]

export const ALL_ROLES: readonly Role[] = Object.values(ROLE)
