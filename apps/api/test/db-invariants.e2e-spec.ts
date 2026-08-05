import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/**
 * Guardrail against `prisma db push` / `migrate reset`. These recreate the tables
 * from schema.prisma, which CANNOT express our triggers, partial (WHERE) unique
 * indexes, or CHECK constraints — so a stray push would silently strip the
 * append-only audit, the "one open pause per ticket" rule, document-no uniqueness,
 * escalation idempotency, and SSE/notify wiring. Prod deploys via `migrate deploy`
 * (which replays the SQL), but nothing else stopped a developer from pushing; this
 * test does, by failing loudly if any SQL-only object is missing after migrate.
 */
describe('SQL-only DB invariants survive migrate (db push guardrail)', () => {
  let db: PrismaClient

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await db.$connect()
  })
  afterAll(async () => {
    await db.$disconnect()
  })

  it('has the triggers Prisma cannot model', async () => {
    const rows = await db.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger WHERE NOT tgisinternal`
    const names = new Set(rows.map((r) => r.tgname))
    for (const t of [
      'ticket_event_append_only', // AD-4 immutable audit
      'ticket_close_sla_pause', // pause auto-closes on transition
      'notification_center_status', // notification-center fan-in
      'ticket_notify_status', // SSE real-time
    ]) {
      expect(names, `missing trigger ${t} — did someone run db push/reset?`).toContain(t)
    }
  })

  it('has the partial (WHERE) unique indexes Prisma cannot express', async () => {
    const rows = await db.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`
    const names = new Set(rows.map((r) => r.indexname))
    for (const idx of [
      'ticket_document_no_active_key', // one active document_no (excl. Cancelled)
      'ticket_sla_pause_one_open', // at most one open pause per ticket
      'notification_escalation_uq', // hourly escalation idempotency
    ]) {
      expect(names, `missing partial-unique ${idx} — did someone run db push/reset?`).toContain(idx)
    }
  })

  it('has the CHECK constraints Prisma cannot express', async () => {
    const rows = await db.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint WHERE contype = 'c'`
    const names = new Set(rows.map((r) => r.conname))
    expect(names).toContain('sla_config_days_positive')
  })
})
