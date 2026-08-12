import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** Story 4.3 — the only post-close fix channel for Payment (FR-14, H5): ACC
 *  returns a wrong hardcopy → DCC1 reopens the closed ticket (`Sent to Accounting`)
 *  → Returned for a fresh round. Reuses the Epic-2 reopen/sendBack chain. */
describe('Payment reopen from Sent to Accounting (e2e)', () => {
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
    await admin.notificationOutbox.deleteMany({})
    await admin.ticketLock.deleteMany({})
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
  })

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  /** A closed Payment ticket at `Sent to Accounting` (with Document No evidence). */
  async function closedPayment(code: string): Promise<string> {
    const t = await admin.ticket.create({
      data: {
        status: 'Sent to Accounting',
        flow: 'Payment',
        applicantSub: 'app-e2e',
        currentHolderSub: null,
        priority: 'normal',
        code,
        paymentNo: `26-CC-${code.slice(-3)}-CT`,
        roundNo: 0,
        statusEnteredAt: new Date('2020-01-01'), // old closure — no time limit (PRD §6)
      },
    })
    return t.id
  }

  it('DCC1 reopens a closed Payment → Returned, new round, code + data kept', async () => {
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const id = await closedPayment('CT-2026-0301')
    const res = await dcc1.post(`/dcc1/tickets/${id}/reopen`).send({ reason: 'ACC trả lại bản cứng sai' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Returned')

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.roundNo).toBe(1) // heavy path (past ACC) counts a round (AC3)
    expect(row.currentHolderSub).toBe('app-e2e') // custody handed back to Applicant (AC5)
    expect(row.code).toBe('CT-2026-0301') // immutable (AD-5)
    expect(row.paymentNo).toBe('26-CC-301-CT') // data preserved
    // Append-only: both chained events recorded, old audit intact (AD-4).
    const actions = (await admin.ticketEvent.findMany({ where: { ticketId: id } })).map((e) => e.action)
    expect(actions).toContain('reopen')
    expect(actions).toContain('sendBack')
  })

  it('reopen needs a reason (the chained sendBack), else 400', async () => {
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const id = await closedPayment('CT-2026-0302')
    const res = await dcc1.post(`/dcc1/tickets/${id}/reopen`).send({})
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ReasonRequired')
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Sent to Accounting') // unchanged
  })

  it('DCC3 cannot reopen — direct reopen is DCC1 only (403); request endpoint removed (404)', async () => {
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const id = await closedPayment('CT-2026-0303')
    // Direct reopen is DCC1-only → 403 for DCC3.
    expect((await dcc3.post(`/dcc1/tickets/${id}/reopen`).send({ reason: 'x' })).status).toBe(403)
    // The old DCC2/DCC3 "request reopen" endpoint was retired → 404 (reopening is DCC1's alone).
    expect((await dcc3.post(`/dcc/tickets/${id}/request-reopen`)).status).toBe(404)

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Sent to Accounting') // still closed, unchanged
  })

  it('closed Payment surfaces in the "Hồ sơ đã đóng" search (DCC3 scope)', async () => {
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    await closedPayment('CT-2026-0304')
    const res = await dcc3.get('/tickets/closed?code=CT-2026-0304')
    expect(res.status).toBe(200)
    // /tickets/closed returns a keyset page {items, nextCursor}; read items.
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].status).toBe('Sent to Accounting')
  })
})
