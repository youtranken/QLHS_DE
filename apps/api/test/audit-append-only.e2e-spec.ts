import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const APP_URL = 'postgresql://qlhs_app:qlhs_app@localhost:5432/qlhs?schema=public'

/**
 * AD-4 append-only, enforced independently of table ownership. GRANT/REVOKE alone
 * is bypassed by the table owner — so if migrations ever run as the app role, the
 * app would own `ticket_event` and could mutate audit. A BEFORE UPDATE/DELETE
 * trigger closes that hole: it blocks ANY non-superuser (the app role is never a
 * superuser) even when explicitly granted UPDATE/DELETE, while a superuser
 * DBA/migration retains surgical access. This test GRANTs the app role mutate
 * rights (the worst case) and proves the trigger still blocks it.
 */
describe('ticket_event is append-only regardless of GRANT/ownership (AD-4)', () => {
  let owner: PrismaClient
  let appRole: PrismaClient
  let ticketId: string

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    appRole = new PrismaClient({ datasources: { db: { url: APP_URL } } })
    await owner.$connect()
    await appRole.$connect()
    // Worst case: the app role has UPDATE/DELETE (as it would if it owned the table).
    await owner.$executeRawUnsafe('GRANT UPDATE, DELETE ON "ticket_event" TO qlhs_app')
  })

  afterAll(async () => {
    await owner.$executeRawUnsafe('REVOKE UPDATE, DELETE ON "ticket_event" FROM qlhs_app')
    await owner.$disconnect()
    await appRole.$disconnect()
  })

  beforeEach(async () => {
    await owner.ticketEvent.deleteMany({})
    await owner.ticket.deleteMany({})
    const t = await owner.ticket.create({
      data: { status: 'Submitted', flow: 'General', applicantSub: 'app-x', priority: 'normal', roundNo: 0 },
    })
    ticketId = t.id
    await owner.ticketEvent.create({
      data: { ticketId, actorSub: 'app-x', action: 'created', fromStatus: 'Submitted', toStatus: 'Submitted', roundNo: 0 },
    })
  })

  it('the app role cannot UPDATE an audit row even when granted UPDATE', async () => {
    await expect(
      appRole.$executeRawUnsafe(`UPDATE "ticket_event" SET reason = 'tampered' WHERE ticket_id = $1`, ticketId),
    ).rejects.toThrow()
    const rows = (await owner.$queryRawUnsafe(
      `SELECT reason FROM "ticket_event" WHERE ticket_id = $1`,
      ticketId,
    )) as Array<{ reason: string | null }>
    expect(rows[0]?.reason).toBeNull() // untouched
  })

  it('the app role cannot DELETE an audit row even when granted DELETE', async () => {
    await expect(
      appRole.$executeRawUnsafe(`DELETE FROM "ticket_event" WHERE ticket_id = $1`, ticketId),
    ).rejects.toThrow()
    const c = (await owner.$queryRawUnsafe(
      `SELECT count(*)::int AS c FROM "ticket_event" WHERE ticket_id = $1`,
      ticketId,
    )) as Array<{ c: number }>
    expect(c[0]?.c).toBe(1) // still there
  })

  it('a superuser (migrations/DBA) may still correct rows — harness reset relies on it', async () => {
    await expect(
      owner.$executeRawUnsafe(`DELETE FROM "ticket_event" WHERE ticket_id = $1`, ticketId),
    ).resolves.toBeDefined()
  })
})
