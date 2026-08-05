import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

interface BoardCol {
  status: string
  reconcile?: boolean
  label?: string
  cards: { id: string; actions: { event: string }[] }[]
}

/** Story 3.3 — DCC1 receives back from ACC & submits BOP (FR-12, AD-16/17). */
describe('DCC1 receive-from-ACC & submit BOP (e2e)', () => {
  let app: INestApplication
  let admin: PrismaClient

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
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

  let seq = 0
  function seed(status: string, roundNo = 0): Promise<{ id: string }> {
    seq += 1
    const n = String(seq).padStart(4, '0')
    return admin.ticket.create({
      data: {
        status,
        flow: 'Contract',
        applicantSub: 'app-e2e',
        currentHolderSub: status === 'Received from ACC' ? 'dcc1-e2e' : null,
        priority: 'normal',
        code: `CT-2026-${n}`,
        documentNo: `26-CC-${n}-CT`,
        roundNo,
      },
    })
  }

  it('AD-16: Submitted to Accounting shows on BOTH DCC1 "Chờ ACC" and DCC2 lanes', async () => {
    const { id } = await seed('Submitted to Accounting')

    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const b1: BoardCol[] = (await dcc1.get('/station-board')).body
    const cho = b1.find((c) => c.label === 'Chờ ACC')
    expect(cho?.cards.map((k) => k.id)).toContain(id)
    expect(cho?.cards[0]?.actions.map((a) => a.event)).toEqual(['receiveFromAcc'])

    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const b2: BoardCol[] = (await dcc2.get('/station-board')).body
    const acc = b2.find((c) => c.status === 'Submitted to Accounting')
    expect(acc?.cards.map((k) => k.id)).toContain(id)
    expect(acc?.cards[0]?.actions).toEqual([]) // read-only for DCC2
  })

  it('DCC1 receives back from ACC (dated) → Received from ACC', async () => {
    const { id } = await seed('Submitted to Accounting')
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const res = await dcc1
      .post(`/dcc1/tickets/${id}/receive-from-acc`)
      .send({ receivedAt: '2026-07-12' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Received from ACC')

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.currentHolderSub).toBe('dcc1-e2e')
    const ev = await admin.ticketEvent.findFirstOrThrow({
      where: { ticketId: id, action: 'receiveFromAcc' },
    })
    expect((ev.meta as { receivedFromAccAt: string }).receivedFromAccAt).toContain('2026-07-12')
  })

  it('AD-17: Received from ACC exposes EXACTLY two actions — Return + Submit BOP', async () => {
    await seed('Received from ACC')
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const board: BoardCol[] = (await dcc1.get('/station-board')).body
    const col = board.find((c) => c.status === 'Received from ACC')
    const events = col?.cards[0]?.actions.map((a) => a.event).sort()
    expect(events).toEqual(['sendBack', 'submitToBop'])
  })

  it('ACC approved → DCC1 submits BOP → Submitted to BOP', async () => {
    const { id } = await seed('Received from ACC')
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const res = await dcc1.post(`/dcc1/tickets/${id}/action`).send({ event: 'submitToBop' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Submitted to BOP')
  })

  it('ACC return (sendBack) → Returned and counts a new round (heavy)', async () => {
    const { id } = await seed('Received from ACC', 0)
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const res = await dcc1
      .post(`/dcc1/tickets/${id}/action`)
      .send({ event: 'sendBack', reason: 'ACC trả bản cứng sai' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Returned')
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.roundNo).toBe(1)
    expect(row.currentHolderSub).toBe('app-e2e')
  })

  it('DCC2 cannot receive-from-ACC (403); DCC1 from the wrong state → 409', async () => {
    const { id } = await seed('Submitted to Accounting')
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    expect((await dcc2.post(`/dcc1/tickets/${id}/receive-from-acc`).send({})).status).toBe(403)

    const { id: wrong } = await seed('Received from ACC')
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    expect((await dcc1.post(`/dcc1/tickets/${wrong}/receive-from-acc`).send({})).status).toBe(409)
  })
})
