/**
 * AD-4 guard. The append-only audit trigger on `ticket_event` raises only when
 * `current_setting('is_superuser') = 'off'` — a PostgreSQL superuser bypasses it
 * entirely, silently re-opening UPDATE/DELETE on the audit trail. Pointing the
 * app's DATABASE_URL at a superuser (a common dev convenience) would therefore
 * disable the whole guarantee, so we refuse to run as one in production.
 */
export function assertAppRoleNotSuperuser(isSuperuser: string, isProd: boolean): void {
  if (isProd && isSuperuser === 'on') {
    throw new Error(
      'DATABASE_URL connects as a PostgreSQL superuser: the append-only audit ' +
        'trigger (AD-4) does not apply to superusers, so ticket_event could be ' +
        'mutated or deleted. Point the app at the restricted qlhs_app role.',
    )
  }
}
