import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { FLOW, ROLE, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const DAY = 86_400_000
const HOLDER = 'dcc2-hoa'

/**
 * F8 oversight — a stopped clock is the one thing that improves an SLA badge
 * without work being done, so Admin must be able to see every one of them.
 */
describe('admin SLA-pause report (e2e — F8)', () => {
  let app: INestApplication
  let db: PrismaClient

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await db.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
  })

  afterAll(async () => {
    await db.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await db.ticketSlaPause.deleteMany({})
    await db.ticketLock.deleteMany({})
    await db.ticketEvent.deleteMany({})
    await db.ticket.deleteMany({})
    await db.userRole.deleteMany({})
    await db.user.deleteMany({})
  })

  async function adminAgent(): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'sa-1', email: 'admin@test.local' })
    return agent
  }

  async function ticket(code: string, status: string = TICKET_STATUS.SubmittedToDcc2) {
    return db.ticket.create({
      data: {
        status,
        flow: FLOW.General,
        applicantSub: 'a',
        priority: 'normal',
        code,
        currentHolderSub: HOLDER,
      },
    })
  }

  it('is Admin-only — a DCC cannot audit their own pausing', async () => {
    const dcc = request.agent(app.getHttpServer())
    await dcc.post('/auth/dev-login').send({ sub: HOLDER, email: 'hoa@test.local', roles: [ROLE.Dcc2] })
    expect((await dcc.get('/admin/sla-pauses')).status).toBe(403)
  })

  it('lists an open pause with who stopped it, why, and for how long', async () => {
    const t = await ticket('PMH-A-2026-0001')
    await db.user.create({ data: { sub: HOLDER, fullName: 'Chị Hoa', email: 'hoa@test.local' } })
    await db.ticketSlaPause.create({
      data: {
        ticketId: t.id,
        reason: 'Chờ nhà thầu bổ sung bản gốc',
        pausedBySub: HOLDER,
        status: TICKET_STATUS.SubmittedToDcc2,
        pausedAt: new Date(Date.now() - 20 * DAY),
      },
    })

    const res = await (await adminAgent()).get('/admin/sla-pauses')
    expect(res.status).toBe(200)
    expect(res.body.open).toHaveLength(1)
    const [open] = res.body.open
    expect(open.code).toBe('PMH-A-2026-0001')
    expect(open.reason).toBe('Chờ nhà thầu bổ sung bản gốc')
    expect(open.pausedByName).toBe('Chị Hoa')
    expect(open.pausedDays).toBeGreaterThanOrEqual(10)
    expect(open.stale).toBe(true)
  })

  it('leaves out clocks that are running again', async () => {
    const t = await ticket('PMH-A-2026-0002')
    await db.ticketSlaPause.create({
      data: {
        ticketId: t.id,
        reason: 'Đã có giấy',
        pausedBySub: HOLDER,
        status: TICKET_STATUS.SubmittedToDcc2,
        pausedAt: new Date(Date.now() - 3 * DAY),
        resumedAt: new Date(),
      },
    })

    const res = await (await adminAgent()).get('/admin/sla-pauses')
    expect(res.body.open).toEqual([])
    // …but it still counts in the habit report — that is the whole point.
    expect(res.body.byStation[0].pauses).toBe(1)
  })

  it('attributes a resumed pause to the station it happened at, not where the ticket is now', async () => {
    const t = await ticket('PMH-A-2026-0003', TICKET_STATUS.SubmittedToVpAndy)
    await db.ticketSlaPause.create({
      data: {
        ticketId: t.id,
        reason: 'Chờ giấy',
        pausedBySub: HOLDER,
        status: TICKET_STATUS.SubmittedToDcc2, // paused back when it sat at DCC2
        pausedAt: new Date(Date.now() - 5 * DAY),
        resumedAt: new Date(Date.now() - 4 * DAY),
      },
    })

    const res = await (await adminAgent()).get('/admin/sla-pauses')
    expect(res.body.byStation).toHaveLength(1)
    expect(res.body.byStation[0].status).toBe(TICKET_STATUS.SubmittedToDcc2)
  })

  it('ranks the station leaning on pause hardest first', async () => {
    const a = await ticket('PMH-A-2026-0004')
    const b = await ticket('PMH-A-2026-0005', TICKET_STATUS.SubmittedToVpAndy)
    const at = new Date(Date.now() - 2 * DAY)
    await db.ticketSlaPause.createMany({
      data: [
        { ticketId: a.id, reason: 'r1', pausedBySub: HOLDER, status: TICKET_STATUS.SubmittedToDcc2, pausedAt: at, resumedAt: new Date() },
        { ticketId: a.id, reason: 'r2', pausedBySub: HOLDER, status: TICKET_STATUS.SubmittedToDcc2, pausedAt: at },
        { ticketId: b.id, reason: 'r3', pausedBySub: HOLDER, status: TICKET_STATUS.SubmittedToVpAndy, pausedAt: at, resumedAt: new Date() },
      ],
    })

    const res = await (await adminAgent()).get('/admin/sla-pauses')
    expect(res.body.byStation.map((s: { status: string }) => s.status)).toEqual([
      TICKET_STATUS.SubmittedToDcc2,
      TICKET_STATUS.SubmittedToVpAndy,
    ])
    expect(res.body.byStation[0]).toMatchObject({ pauses: 2, tickets: 1, openNow: 1 })
  })

  it('does not count a paused ticket as overdue on the landing page', async () => {
    // Ancient entry time → overdue against the seeded ('Submitted','*',1) threshold…
    const stale = new Date(Date.now() - 30 * DAY)
    const t = await db.ticket.create({
      data: {
        status: TICKET_STATUS.Submitted,
        flow: FLOW.General,
        applicantSub: 'a',
        priority: 'normal',
        code: 'PMH-A-2026-0011',
        currentHolderSub: HOLDER,
        statusEnteredAt: stale,
      },
    })
    const before = await (await adminAgent()).get('/admin/overview')
    expect(before.body.overdueTotal).toBe(1)

    // …until the clock is stopped. The console must agree with the board (F8).
    await db.ticketSlaPause.create({
      data: { ticketId: t.id, reason: 'Chờ giấy', pausedBySub: HOLDER, status: TICKET_STATUS.Submitted, pausedAt: stale },
    })
    const after = await (await adminAgent()).get('/admin/overview')
    expect(after.body.overdueTotal).toBe(0)
    expect(after.body.pausedTotal).toBe(1)
  })

  it('surfaces the count on the Admin landing so pause cannot become a quiet habit', async () => {
    const t = await ticket('PMH-A-2026-0006')
    await db.ticketSlaPause.create({
      data: { ticketId: t.id, reason: 'Chờ giấy', pausedBySub: HOLDER, status: TICKET_STATUS.SubmittedToDcc2 },
    })
    const res = await (await adminAgent()).get('/admin/overview')
    expect(res.body.pausedTotal).toBe(1)
  })

  it('closes an open pause the moment the ticket moves to another station', async () => {
    const t = await ticket('PMH-A-2026-0008')
    await db.ticketSlaPause.create({
      data: { ticketId: t.id, reason: 'Chờ giấy', pausedBySub: HOLDER, status: TICKET_STATUS.SubmittedToDcc2 },
    })
    // Any status change closes it — enforced by trigger, so it holds no matter
    // which of the six repos performed the transition.
    await db.ticket.update({ where: { id: t.id }, data: { status: TICKET_STATUS.ReceivedByDcc2 } })

    const row = await db.ticketSlaPause.findFirstOrThrow({ where: { ticketId: t.id } })
    expect(row.resumedAt).not.toBeNull()
    expect(row.resumedBySub).toBeNull() // nobody resumed it — the move did

    const res = await (await adminAgent()).get('/admin/sla-pauses')
    expect(res.body.open).toEqual([])
  })

  it('lets the ticket be paused again at its new station — the old window must not block it', async () => {
    const t = await ticket('PMH-A-2026-0009')
    const dcc = request.agent(app.getHttpServer())
    await dcc.post('/auth/dev-login').send({ sub: HOLDER, email: 'hoa@test.local', roles: [ROLE.Dcc2] })
    await dcc.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ lần 1' }).expect(200)
    await db.ticket.update({ where: { id: t.id }, data: { status: TICKET_STATUS.ReceivedByDcc2 } })

    await dcc.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ lần 2' }).expect(200)
    expect(await db.ticketSlaPause.count({ where: { ticketId: t.id } })).toBe(2)
  })

  it('refuses to pause a ticket that is already closed', async () => {
    const t = await ticket('PMH-A-2026-0010', TICKET_STATUS.Completed)
    const dcc = request.agent(app.getHttpServer())
    await dcc.post('/auth/dev-login').send({ sub: HOLDER, email: 'hoa@test.local', roles: [ROLE.Dcc2] })
    await dcc.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ giấy' }).expect(409)
  })

  it('records the station automatically when a holder pauses through the API', async () => {
    const t = await ticket('PMH-A-2026-0007')
    const dcc = request.agent(app.getHttpServer())
    await dcc.post('/auth/dev-login').send({ sub: HOLDER, email: 'hoa@test.local', roles: [ROLE.Dcc2] })
    await dcc.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ nhà thầu' }).expect(200)

    const row = await db.ticketSlaPause.findFirstOrThrow({ where: { ticketId: t.id } })
    expect(row.status).toBe(TICKET_STATUS.SubmittedToDcc2)
  })
})
