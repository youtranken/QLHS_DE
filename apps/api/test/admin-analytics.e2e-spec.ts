import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { ALL_FLOWS, FLOW, ROLE, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'
import { dwellHeatmap } from '../src/domain/analytics/dwell'
import { throughputByPeriod } from '../src/domain/analytics/throughput'
import { returnRateByFlow } from '../src/domain/analytics/return-rate'
import type { AnalyticsEvent } from '../src/domain/analytics/types'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const DAY = 86_400_000

/** 2.4 — management analytics, all derived from ticket_event at read (AD-6). */
describe('admin analytics (e2e — 2.4)', () => {
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

  async function ticket(code: string, flow: string, status: string, statusEnteredAt?: Date) {
    return db.ticket.create({
      data: { status, flow, applicantSub: 'a', priority: 'normal', code, statusEnteredAt },
    })
  }

  function event(
    ticketId: string,
    action: string,
    toStatus: string,
    occurredAt: Date,
    fromStatus = TICKET_STATUS.Submitted,
  ) {
    return db.ticketEvent.create({
      data: { ticketId, actorSub: 'a', action, fromStatus, toStatus, roundNo: 0, occurredAt },
    })
  }

  it('is Admin-only', async () => {
    const dcc = request.agent(app.getHttpServer())
    await dcc.post('/auth/dev-login').send({ sub: 'd1', email: 'd1@test.local', roles: [ROLE.Dcc1] })
    expect((await dcc.get('/admin/analytics')).status).toBe(403)
  })

  it('reports throughput, return rate, dwell and the top overdue list', async () => {
    // General ticket: created -10d, moved to VP Andy -8d, completed -6d.
    const a = await ticket('PMH-A-2026-0001', FLOW.General, TICKET_STATUS.Completed)
    await event(a.id, TICKET_EVENT.Created, TICKET_STATUS.Submitted, new Date(Date.now() - 10 * DAY))
    await event(a.id, TICKET_EVENT.SubmitToAndy, TICKET_STATUS.SubmittedToVpAndy, new Date(Date.now() - 8 * DAY))
    await event(a.id, TICKET_EVENT.AndyApproveComplete, TICKET_STATUS.Completed, new Date(Date.now() - 6 * DAY))

    // Contract ticket that bounced once.
    const b = await ticket('PMH-B-2026-0002', FLOW.Contract, TICKET_STATUS.Returned)
    await event(b.id, TICKET_EVENT.Created, TICKET_STATUS.Submitted, new Date(Date.now() - 5 * DAY))
    await event(b.id, TICKET_EVENT.SendBack, TICKET_STATUS.Returned, new Date(Date.now() - 4 * DAY))

    // A live, badly overdue ticket sitting in the Pool (seeded threshold 1 day).
    await ticket('PMH-A-2026-0003', FLOW.General, TICKET_STATUS.Submitted, new Date(Date.now() - 30 * DAY))

    const res = await (await adminAgent()).get('/admin/analytics?granularity=month')
    expect(res.status).toBe(200)

    // Throughput: 2 created, 1 completed across the window.
    const created = res.body.throughput.reduce((n: number, p: { created: number }) => n + p.created, 0)
    const completed = res.body.throughput.reduce((n: number, p: { completed: number }) => n + p.completed, 0)
    expect(created).toBe(2)
    expect(completed).toBe(1)

    // Return rate: Contract had one SendBack over one ticket.
    const contract = res.body.returns.find((r: { flow: string }) => r.flow === FLOW.Contract)
    expect(contract).toMatchObject({ returns: 1, tickets: 1, ratePct: 100 })

    // Dwell: the General ticket sat in Submitted for 2 days before moving on.
    const submitted = res.body.dwell.find((d: { status: string }) => d.status === TICKET_STATUS.Submitted)
    expect(submitted).toBeTruthy()
    expect(submitted.avgDays).toBeGreaterThan(0)

    // Top overdue: the 30-day-old Pool ticket leads.
    expect(res.body.topOverdue[0].code).toBe('PMH-A-2026-0003')
    expect(res.body.topOverdue[0].overdueDays).toBeGreaterThan(0)
  })

  it('SQL aggregation agrees with the pure functions on the same events (throughput/returns/dwell)', async () => {
    // Rich history: two flows, a double-bounce, weekend-spanning gaps, and an
    // event at 17:30 UTC = 00:30 next-day ICT to pin the civil-period bucketing.
    const g = await ticket('PMH-A-2026-1001', FLOW.General, TICKET_STATUS.Completed)
    await event(g.id, TICKET_EVENT.Created, TICKET_STATUS.Submitted, new Date('2026-07-06T02:00:00Z'))
    await event(g.id, TICKET_EVENT.SubmitToAndy, TICKET_STATUS.SubmittedToVpAndy, new Date('2026-07-09T02:00:00Z'))
    await event(g.id, TICKET_EVENT.AndyApproveComplete, TICKET_STATUS.Completed, new Date('2026-07-31T17:30:00Z'))

    const c = await ticket('PMH-B-2026-1002', FLOW.Contract, TICKET_STATUS.Returned)
    await event(c.id, TICKET_EVENT.Created, TICKET_STATUS.Submitted, new Date('2026-07-10T02:00:00Z'))
    await event(c.id, TICKET_EVENT.SendBack, TICKET_STATUS.Returned, new Date('2026-07-13T02:00:00Z'))
    await event(c.id, TICKET_EVENT.Resubmit, TICKET_STATUS.Submitted, new Date('2026-07-14T02:00:00Z'))
    await event(c.id, TICKET_EVENT.SendBack, TICKET_STATUS.Returned, new Date('2026-07-20T02:00:00Z'))

    const p = await ticket('PMH-C-2026-1003', FLOW.Payment, TICKET_STATUS.SentToAccounting)
    await event(p.id, TICKET_EVENT.Created, TICKET_STATUS.Submitted, new Date('2026-08-03T02:00:00Z'))
    await event(p.id, TICKET_EVENT.SendToAccounting, TICKET_STATUS.SentToAccounting, new Date('2026-08-05T02:00:00Z'))

    // Oracle: read the same events the pure functions would, straight from the DB.
    const rows = await db.ticketEvent.findMany({
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: { ticketId: true, action: true, fromStatus: true, toStatus: true, occurredAt: true, ticket: { select: { flow: true } } },
    })
    const events: AnalyticsEvent[] = rows.map((r) => ({
      ticketId: r.ticketId, flow: r.ticket.flow, action: r.action,
      fromStatus: r.fromStatus, toStatus: r.toStatus, occurredAt: r.occurredAt,
    }))
    const flows = [...ALL_FLOWS]
    const byStatus = <T extends { status: string }>(a: T[]) => [...a].sort((x, y) => x.status.localeCompare(y.status))

    const res = await (await adminAgent()).get('/admin/analytics?granularity=month')
    expect(res.status).toBe(200)
    expect(res.body.throughput).toEqual(throughputByPeriod(events, 'month'))
    expect(res.body.returns).toEqual(returnRateByFlow(events, flows))
    expect(byStatus(res.body.dwell)).toEqual(byStatus(dwellHeatmap(events, flows)))

    // The 17:30Z (=00:30 ICT next day) completion must land in August, not July:
    // July has zero completions, August has both (the boundary one + the Payment).
    expect(res.body.throughput.find((b: { period: string }) => b.period === '2026-07')?.completed).toBe(0)
    expect(res.body.throughput.find((b: { period: string }) => b.period === '2026-08')?.completed).toBe(2)
  })

  it('exports the raw event window as a UTF-8 CSV', async () => {
    const a = await ticket('PMH-A-2026-0009', FLOW.General, TICKET_STATUS.Submitted)
    await event(a.id, TICKET_EVENT.Created, TICKET_STATUS.Submitted, new Date('2026-07-10T03:00:00Z'))

    const res = await (await adminAgent()).get('/admin/analytics/export?from=2026-07-01&to=2026-07-31')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('qlhs-analytics.csv')
    expect(res.text.charCodeAt(0)).toBe(0xfeff) // BOM
    expect(res.text).toContain('Mã hồ sơ')
    expect(res.text).toContain('PMH-A-2026-0009')
  })
})
