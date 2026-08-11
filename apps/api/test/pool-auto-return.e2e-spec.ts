import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AppModule } from '../src/app.module'
import { PoolAutoReturnScheduler } from '../src/infra/scheduler/pool-auto-return.scheduler'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** Pool auto-return (FR-15): an un-picked Submitted ticket past the 4-business-day
 *  grace is returned to its Applicant, landing at Return-fixing, with an immediate
 *  `auto_returned` email notice — a DISTINCT outbox kind so it can't collide with a
 *  manual `Returned` written in the same round (the review MEDIUM). */
describe('Pool auto-return scheduler (e2e)', () => {
  let app: INestApplication
  let admin: PrismaClient
  let sched: PoolAutoReturnScheduler

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    sched = app.get(PoolAutoReturnScheduler)
  })

  afterAll(async () => {
    await admin.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await admin.notificationOutbox.deleteMany({})
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
  })

  const DAYS_20_AGO = new Date(Date.now() - 20 * 24 * 3600 * 1000) // ≫ 4 business days

  function seed(statusEnteredAt: Date): Promise<{ id: string }> {
    return admin.ticket.create({
      data: {
        status: 'Submitted',
        flow: 'General',
        applicantSub: 'app-auto',
        priority: 'normal',
        roundNo: 0,
        statusEnteredAt,
      },
    })
  }

  it('returns an over-grace Pool ticket → Return-fixing + an auto_returned notice to the Applicant', async () => {
    const { id } = await seed(DAYS_20_AGO)

    const n = await sched.scan()
    expect(n).toBe(1)

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Return-fixing')
    expect(row.currentHolderSub).toBe('app-auto') // back with the Applicant
    expect(row.roundNo).toBe(0) // light edge — no round bump

    // The audit row is written by the system actor.
    const ev = await admin.ticketEvent.findFirstOrThrow({ where: { ticketId: id, action: 'auto_return' } })
    expect(ev.actorSub).toBe('system')

    const outbox = await admin.notificationOutbox.findMany({ where: { ticketId: id } })
    expect(outbox).toHaveLength(1)
    expect(outbox[0]?.kind).toBe('auto_returned')
    expect(outbox[0]?.recipientSub).toBe('app-auto')
  })

  it('does NOT swallow the auto-return email when a manual Returned already exists in the same round', async () => {
    const { id } = await seed(DAYS_20_AGO)
    // Simulate an earlier MANUAL return this round (same round_no=0): its notice is
    // kind 'Returned'. The auto-return notice must still be enqueued (distinct kind).
    await admin.notificationOutbox.create({
      data: { ticketId: id, roundNo: 0, kind: 'Returned', recipientSub: 'app-auto', status: 'sent' },
    })

    await sched.scan()

    const kinds = (await admin.notificationOutbox.findMany({ where: { ticketId: id } })).map((o) => o.kind).sort()
    expect(kinds).toEqual(['Returned', 'auto_returned']) // both present — no collision
  })

  it('leaves a fresh (within-grace) Pool ticket untouched', async () => {
    await seed(new Date()) // 0 business days
    expect(await sched.scan()).toBe(0)
  })
})
