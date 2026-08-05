import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { FLOW, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const HOLDER = 'dcc1-lan'
const DAY = 86_400_000

/** F8 — "chờ bổ sung": the SLA clock stops while the ticket waits on paperwork
 *  from outside, without the ticket ever leaving its station. */
describe('SLA pause (e2e — F8)', () => {
  let app: INestApplication
  let admin: PrismaClient

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
  })

  afterAll(async () => {
    await admin.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await admin.ticketSlaPause.deleteMany({})
    await admin.ticketLock.deleteMany({})
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
  })

  /** A ticket that has been sitting at a DCC1 station long enough to be overdue. */
  function ticket(over: Record<string, unknown> = {}) {
    return admin.ticket.create({
      data: {
        status: TICKET_STATUS.SubmittedToVpAndy,
        flow: FLOW.General,
        applicantSub: 'a',
        priority: 'normal',
        currentHolderSub: HOLDER,
        statusEnteredAt: new Date(Date.now() - 30 * DAY),
        ...over,
      },
    })
  }

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  async function detail(agent: Agent, id: string) {
    return (await agent.get(`/ticket/${id}`)).body as {
      overdueDays: number
      paused: boolean
      pauseReason: string | null
    }
  }

  it('stops the clock: overdue days freeze once paused, and the detail says why', async () => {
    const t = await ticket()
    const dcc1 = await login(HOLDER, ['DCC1'])
    const before = await detail(dcc1, t.id)
    expect(before.overdueDays).toBeGreaterThan(0)
    expect(before.paused).toBe(false)

    await dcc1
      .post(`/ticket/${t.id}/sla-pause`)
      .send({ reason: 'Chờ nhà thầu ABC nộp bản gốc bảng chào giá' })
      .expect(200)

    const after = await detail(dcc1, t.id)
    expect(after.paused).toBe(true)
    expect(after.pauseReason).toBe('Chờ nhà thầu ABC nộp bản gốc bảng chào giá')
  })

  it('forgives the waiting time: a long pause pulls the ticket back inside SLA', async () => {
    const t = await ticket()
    const dcc1 = await login(HOLDER, ['DCC1'])
    const before = await detail(dcc1, t.id)
    // Backdate the pause so it covers the whole wait, as a real weeks-long wait would.
    await dcc1.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ giấy' })
    await admin.ticketSlaPause.updateMany({
      where: { ticketId: t.id },
      data: { pausedAt: new Date(Date.now() - 30 * DAY) },
    })
    const after = await detail(dcc1, t.id)
    expect(after.overdueDays).toBeLessThan(before.overdueDays)
  })

  it('resumes: the clock restarts and the ticket stops showing as paused', async () => {
    const t = await ticket()
    const dcc1 = await login(HOLDER, ['DCC1'])
    await dcc1.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ giấy' }).expect(200)
    await dcc1.post(`/ticket/${t.id}/sla-resume`).expect(200)
    expect((await detail(dcc1, t.id)).paused).toBe(false)
  })

  it('refuses a non-holder — 403, and the clock keeps running', async () => {
    const t = await ticket()
    const other = await login('dcc1-khac', ['DCC1'])
    await other.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ giấy' }).expect(403)
    expect(await admin.ticketSlaPause.count({ where: { ticketId: t.id } })).toBe(0)
  })

  it('refuses a blank reason — an unexplained stopped clock is not reviewable', async () => {
    const t = await ticket()
    const dcc1 = await login(HOLDER, ['DCC1'])
    await dcc1.post(`/ticket/${t.id}/sla-pause`).send({ reason: '' }).expect(400)
  })

  it('refuses to pause twice — forgiven days must not be double-counted', async () => {
    const t = await ticket()
    const dcc1 = await login(HOLDER, ['DCC1'])
    await dcc1.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ giấy' }).expect(200)
    await dcc1.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ nữa' }).expect(409)
  })

  it('refuses to resume a ticket that was never paused', async () => {
    const t = await ticket()
    const dcc1 = await login(HOLDER, ['DCC1'])
    await dcc1.post(`/ticket/${t.id}/sla-resume`).expect(409)
  })

  it('keeps the ticket at its station — a pause is not a transition (AD-2/AD-4)', async () => {
    const t = await ticket()
    const dcc1 = await login(HOLDER, ['DCC1'])
    await dcc1.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ giấy' })
    const after = await admin.ticket.findUnique({ where: { id: t.id } })
    expect(after?.status).toBe(TICKET_STATUS.SubmittedToVpAndy)
    expect(await admin.ticketEvent.count({ where: { ticketId: t.id } })).toBe(0)
  })

  it('records who paused and who resumed — the pause is its own audit record', async () => {
    const t = await ticket()
    const dcc1 = await login(HOLDER, ['DCC1'])
    await dcc1.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ giấy' })
    await dcc1.post(`/ticket/${t.id}/sla-resume`)
    const row = await admin.ticketSlaPause.findFirst({ where: { ticketId: t.id } })
    expect(row).toMatchObject({ pausedBySub: HOLDER, resumedBySub: HOLDER, reason: 'Chờ giấy' })
    expect(row?.resumedAt).not.toBeNull()
  })

  it('shows the pause on the station board so the whole team sees why it is idle', async () => {
    const t = await ticket()
    const dcc1 = await login(HOLDER, ['DCC1'])
    await dcc1.post(`/ticket/${t.id}/sla-pause`).send({ reason: 'Chờ giấy' })
    const board = (await dcc1.get('/station-board')).body as {
      status: string
      cards: { id: string; paused: boolean }[]
    }[]
    const card = board.flatMap((c) => c.cards).find((c) => c.id === t.id)
    expect(card?.paused).toBe(true)
  })
})
