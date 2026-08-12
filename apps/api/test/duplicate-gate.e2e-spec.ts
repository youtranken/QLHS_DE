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

interface Card {
  id: string
  actions: { event: string }[]
  dupOf?: { id: string; tier: string; code: string | null }[]
}

/** F12 — the duplicate gate lives at DCC1's Pool: hints on the card, and the
 *  Return that lets DCC1 act on them. */
describe('duplicate gate (e2e — F12)', () => {
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
    await admin.ticketLock.deleteMany({})
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
  })

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  // Payment flow: the Applicant enters a real Contract No reference (Contract flow
  // locks it to 'N/A' — DCC2 assigns later), and that reference is NOT unique
  // (many payments per contract), so two tickets can legitimately share it — the
  // exact shape F12 inspects at reception.
  function ticket(over: Record<string, unknown> = {}) {
    return admin.ticket.create({
      data: {
        status: TICKET_STATUS.Submitted,
        flow: FLOW.Payment,
        applicantSub: 'a',
        priority: 'normal',
        // The gate matches on Document Type + Contract No + Project/Team (within a month).
        documentType: 'Payment',
        contractNo: 'HĐ-2026/ABC',
        projectTeam: 'Team Alpha',
        contractor: 'Công ty ABC',
        amount: 500_000_000n,
        currency: 'VND',
        ...over,
      },
    })
  }

  async function poolCards(agent: Agent): Promise<Card[]> {
    const board = (await agent.get('/station-board')).body as { status: string; cards: Card[] }[]
    return board.find((c) => c.status === TICKET_STATUS.Submitted)?.cards ?? []
  }

  it('flags a re-submit of the same contract no + amount, naming the ticket it clashes with', async () => {
    const first = await ticket({ code: 'PMH-B-2026-0001', status: TICKET_STATUS.SubmittedToVpAndy })
    const again = await ticket()
    const dcc1 = await login('d1', ['DCC1'])
    const card = (await poolCards(dcc1)).find((c) => c.id === again.id)
    expect(card?.dupOf).toEqual([
      expect.objectContaining({ id: first.id, tier: 'strong', code: 'PMH-B-2026-0001' }),
    ])
  })

  it('leaves an unrelated ticket unflagged — no false alarm on a clean Pool', async () => {
    await ticket({ contractNo: 'HD-KHAC-1', contractor: 'Nhà thầu XYZ', amount: 12_000n })
    const only = await ticket()
    const dcc1 = await login('d1', ['DCC1'])
    const card = (await poolCards(dcc1)).find((c) => c.id === only.id)
    expect(card?.dupOf).toEqual([])
  })

  it('offers Return once DCC1 has picked the card, and Returning it actually moves the ticket', async () => {
    const t = await ticket()
    const dcc1 = await login('d1', ['DCC1'])
    await dcc1.post(`/dcc1/pool/${t.id}/pick`).expect(201)

    const picked = (await poolCards(dcc1)).find((c) => c.id === t.id)
    expect(picked?.actions.map((a) => a.event)).toContain('sendBack')

    await dcc1
      .post(`/dcc1/tickets/${t.id}/action`)
      .send({ event: 'sendBack', reason: 'Trùng với hồ sơ PMH-B-2026-0001.' })
      .expect(201)

    const after = await admin.ticket.findUnique({ where: { id: t.id } })
    expect(after?.status).toBe(TICKET_STATUS.Returned)
  })

  it('records the Return reason in the audit trail so the duplicate call is reviewable', async () => {
    const t = await ticket()
    const dcc1 = await login('d1', ['DCC1'])
    await dcc1.post(`/dcc1/pool/${t.id}/pick`)
    await dcc1.post(`/dcc1/tickets/${t.id}/action`).send({ event: 'sendBack', reason: 'Trùng hồ sơ cũ.' })
    const events = await admin.ticketEvent.findMany({ where: { ticketId: t.id } })
    expect(events.at(-1)).toMatchObject({ action: 'sendBack', reason: 'Trùng hồ sơ cũ.' })
  })

  it('never flags a Cancelled predecessor — resubmitting after a withdrawal is the intended path', async () => {
    await ticket({ status: TICKET_STATUS.Cancelled, code: 'PMH-B-2026-0009' })
    const again = await ticket()
    const dcc1 = await login('d1', ['DCC1'])
    const card = (await poolCards(dcc1)).find((c) => c.id === again.id)
    expect(card?.dupOf).toEqual([])
  })
})
