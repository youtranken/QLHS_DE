import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { FLOW, ROLE, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { EscalationScheduler } from '../src/infra/scheduler/escalation.scheduler'
import { ESCALATION_KIND } from '../src/domain/notify/escalation'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const DAY = 86_400_000

/** 2.5 — the SLA escalation ladder posts tiered notifications into the 2.2 table. */
describe('SLA escalation ladder (e2e — 2.5)', () => {
  let app: INestApplication
  let db: PrismaClient
  let scheduler: EscalationScheduler

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await db.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    scheduler = app.get(EscalationScheduler)
  })

  afterAll(async () => {
    await db.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await db.notificationRead.deleteMany({})
    await db.notification.deleteMany({})
    await db.ticketSlaPause.deleteMany({})
    await db.ticketEvent.deleteMany({})
    await db.ticket.deleteMany({})
  })

  async function ticket(over: {
    code: string
    status: string
    flow?: string
    holder?: string | null
    enteredDaysAgo?: number
  }) {
    return db.ticket.create({
      data: {
        status: over.status,
        flow: over.flow ?? FLOW.General,
        applicantSub: 'a',
        priority: 'normal',
        code: over.code,
        currentHolderSub: over.holder ?? null,
        statusEnteredAt: new Date(Date.now() - (over.enteredDaysAgo ?? 0) * DAY),
      },
    })
  }

  // Only escalation rows — creating a ticket also fires the 2.2 entry trigger.
  const escalations = (ticketId: string) =>
    db.notification.findMany({
      where: { ticketId, kind: { in: Object.values(ESCALATION_KIND) } },
      orderBy: { id: 'asc' },
    })

  it('nudges the holder privately when a held ticket is due soon', async () => {
    // Submitted to VP Andy = 1-day SLA; entered now → 0 elapsed, 1 day left → warn.
    const t = await ticket({ code: 'PMH-A-0001', status: TICKET_STATUS.SubmittedToVpAndy, holder: 'dcc1-nam' })
    await scheduler.scan()
    const [n] = await escalations(t.id)
    expect(n).toMatchObject({ kind: ESCALATION_KIND.Warn, recipientSub: 'dcc1-nam', recipientRole: null })
  })

  it('sends the Pool due-soon nudge to DCC1 (nobody holds it yet)', async () => {
    const t = await ticket({ code: 'PMH-A-0002', status: TICKET_STATUS.Submitted, holder: null })
    await scheduler.scan()
    const [n] = await escalations(t.id)
    expect(n).toMatchObject({ kind: ESCALATION_KIND.Warn, recipientSub: null, recipientRole: ROLE.Dcc1 })
  })

  it('escalates a badly overdue ticket all the way to Admin', async () => {
    const t = await ticket({
      code: 'PMH-A-0003',
      status: TICKET_STATUS.ReceivedByDcc2,
      flow: FLOW.Contract,
      holder: 'dcc2-hoa',
      enteredDaysAgo: 40,
    })
    await scheduler.scan()
    const [n] = await escalations(t.id)
    expect(n).toMatchObject({ kind: ESCALATION_KIND.Critical, recipientRole: ROLE.Admin, recipientSub: null })
  })

  it('is idempotent — the hourly re-run never double-posts the same tier', async () => {
    const t = await ticket({ code: 'PMH-A-0004', status: TICKET_STATUS.SubmittedToVpAndy, holder: 'dcc1-nam' })
    await scheduler.scan()
    await scheduler.scan()
    expect(await escalations(t.id)).toHaveLength(1)
  })

  it('does not escalate a paused ticket — its clock is stopped on purpose (F8)', async () => {
    const t = await ticket({
      code: 'PMH-A-0005',
      status: TICKET_STATUS.ReceivedByDcc2,
      flow: FLOW.Contract,
      holder: 'dcc2-hoa',
      enteredDaysAgo: 40,
    })
    await db.ticketSlaPause.create({
      data: {
        ticketId: t.id,
        reason: 'Chờ bổ sung',
        pausedBySub: 'dcc2-hoa',
        status: TICKET_STATUS.ReceivedByDcc2,
        pausedAt: new Date(Date.now() - 40 * DAY),
      },
    })
    await scheduler.scan()
    expect(await escalations(t.id)).toEqual([])
  })

  it('leaves an Applicant-owned Return alone (that is the Return reminder’s job)', async () => {
    const t = await ticket({ code: 'PMH-A-0006', status: TICKET_STATUS.Returned, enteredDaysAgo: 40 })
    await scheduler.scan()
    expect(await escalations(t.id)).toEqual([])
  })
})
