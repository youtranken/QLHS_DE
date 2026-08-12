import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const APP_URL = 'postgresql://qlhs_app:qlhs_app@localhost:5432/qlhs?schema=public'

/**
 * MED-5 / B4 — the webhook idempotency ledger is append-only for the app role.
 * `qlhs_app` used to keep UPDATE/DELETE on it via ALTER DEFAULT PRIVILEGES; the
 * migration REVOKEs them. The app only INSERTs (ON CONFLICT DO NOTHING) + SELECTs,
 * so this proves the dedup ledger can't be rewritten/erased by the app role while
 * the normal INSERT path keeps working (no prod impact).
 */
describe('processed_webhook_event is append-only for the app role (MED-5)', () => {
  let owner: PrismaClient
  let appRole: PrismaClient

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    appRole = new PrismaClient({ datasources: { db: { url: APP_URL } } })
    await owner.$connect()
    await appRole.$connect()
  })

  afterAll(async () => {
    await owner.$disconnect()
    await appRole.$disconnect()
  })

  beforeEach(async () => {
    await owner.processedWebhookEvent.deleteMany({})
    await owner.processedWebhookEvent.create({ data: { eventId: 'evt-1' } })
  })

  it('the app role can still INSERT — the dedup ledger keeps working', async () => {
    await appRole.processedWebhookEvent.createMany({ data: [{ eventId: 'evt-2' }], skipDuplicates: true })
    const rows = await owner.processedWebhookEvent.findMany()
    expect(rows.map((r) => r.eventId).sort()).toEqual(['evt-1', 'evt-2'])
  })

  it('the app role CANNOT UPDATE a ledger row', async () => {
    await expect(
      appRole.$executeRawUnsafe(`UPDATE "processed_webhook_event" SET received_at = now() WHERE event_id = $1`, 'evt-1'),
    ).rejects.toThrow()
  })

  it('the app role CANNOT DELETE a ledger row', async () => {
    await expect(
      appRole.$executeRawUnsafe(`DELETE FROM "processed_webhook_event" WHERE event_id = $1`, 'evt-1'),
    ).rejects.toThrow()
    const rows = await owner.processedWebhookEvent.findMany()
    expect(rows).toHaveLength(1) // untouched
  })
})
