import { Client } from 'pg'

// Owner connection (qlhs) to the throwaway e2e DB: reset needs TRUNCATE + the
// ability to clear append-only ticket_event, which the app role (qlhs_app) can't.
const OWNER_URL =
  process.env.E2E_OWNER_DB_URL ?? 'postgresql://qlhs:qlhs@localhost:5432/qlhs_e2e'

// Business + appointment tables wiped between tests; seeded config (sla_config,
// option_item, local_credential) is kept so the app behaves like a real install.
const TABLES = [
  'ticket_event',
  'ticket',
  'ticket_sla_pause',
  'ticket_lock',
  'ticket_view',
  'notification_read',
  'notification',
  'digest_outbox',
  'notification_outbox',
  'number_counter',
  'user_role',
  'user',
]

async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: OWNER_URL })
  await c.connect()
  try {
    return await fn(c)
  } finally {
    await c.end()
  }
}

export function resetDb(): Promise<void> {
  return withClient(async (c) => {
    await c.query(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
  })
}

/** Current status of a ticket by human code — the persisted cross-check for a
 *  UI-driven journey. */
export function statusByCode(code: string): Promise<string | null> {
  return withClient(async (c) => {
    const r = await c.query<{ status: string }>('SELECT status FROM ticket WHERE code = $1', [code])
    return r.rows[0]?.status ?? null
  })
}

/** Stored contract_no of a ticket by code — a skip with a blank number stores 'N/A'. */
export function contractNoByCode(code: string): Promise<string | null> {
  return withClient(async (c) => {
    const r = await c.query<{ contract_no: string | null }>(
      'SELECT contract_no FROM ticket WHERE code = $1',
      [code],
    )
    return r.rows[0]?.contract_no ?? null
  })
}

/** Audit rows for a ticket, oldest first — used to prove the Skip Completed chain
 *  wrote every step (append-only, AD-4) attributed to the system. */
export function eventsByCode(
  code: string,
): Promise<{ action: string; actorSub: string; reason: string | null }[]> {
  return withClient(async (c) => {
    const r = await c.query<{ action: string; actor_sub: string; reason: string | null }>(
      `SELECT e.action, e.actor_sub, e.reason
         FROM ticket_event e JOIN ticket t ON t.id = e.ticket_id
        WHERE t.code = $1
        ORDER BY e.occurred_at, e.id`,
      [code],
    )
    return r.rows.map((x) => ({ action: x.action, actorSub: x.actor_sub, reason: x.reason }))
  })
}

export function ticketCount(): Promise<number> {
  return withClient(async (c) => {
    const r = await c.query<{ n: string }>('SELECT count(*)::text AS n FROM ticket')
    return Number(r.rows[0]!.n)
  })
}

/** The one open ticket's code (or null) — journeys create exactly one at a time. */
export function soleTicketCode(): Promise<string | null> {
  return withClient(async (c) => {
    const r = await c.query<{ code: string | null }>(
      'SELECT code FROM ticket ORDER BY created_at DESC LIMIT 1',
    )
    return r.rows[0]?.code ?? null
  })
}
