import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** Story 4.2 — DCC3 enters a Document No and sends to ACC, CLOSING the ticket in
 *  one hop at `Sent to Accounting` (H5): no BOP, no Completed, NO Applicant email;
 *  Document No is the evidence, unique at the DB (M5 index shared with Contract). */
describe('Payment send to Accounting = closed at Sent to Accounting (e2e)', () => {
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

  /** A Payment ticket already at `Received by DCC3`. */
  async function receivedByDcc3(code: string): Promise<string> {
    const t = await admin.ticket.create({
      data: {
        status: 'Received by DCC3',
        flow: 'Payment',
        applicantSub: 'app-e2e',
        currentHolderSub: 'dcc3-e2e',
        priority: 'normal',
        code,
        roundNo: 0,
      },
    })
    return t.id
  }

  it('valid Document No → Sent to Accounting (closed), persisted, holder cleared', async () => {
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const id = await receivedByDcc3('CT-2026-0201')
    const res = await dcc3
      .post(`/dcc3/tickets/${id}/send-accounting`)
      .send({ documentNo: '26-CC-201-CT' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Sent to Accounting')

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.documentNo).toBe('26-CC-201-CT')
    expect(row.currentHolderSub).toBeNull() // terminal → no holder (AC5)
    const ev = await admin.ticketEvent.findFirstOrThrow({
      where: { ticketId: id, action: 'sendToAccounting' },
    })
    expect(ev.toStatus).toBe('Sent to Accounting')
    expect((ev.meta as { documentNo: string }).documentNo).toBe('26-CC-201-CT')
  })

  it('closing Payment writes NO Applicant email intent (H5, AC2)', async () => {
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const id = await receivedByDcc3('CT-2026-0202')
    await dcc3.post(`/dcc3/tickets/${id}/send-accounting`).send({ documentNo: '26-CC-202-CT' })
    const outbox = await admin.notificationOutbox.findMany({ where: { ticketId: id } })
    expect(outbox).toHaveLength(0)
  })

  it('rejects an empty Document No (400) before touching the DB', async () => {
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const id = await receivedByDcc3('CT-2026-0203')
    const res = await dcc3.post(`/dcc3/tickets/${id}/send-accounting`).send({ documentNo: '   ' })
    expect(res.status).toBe(400)
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Received by DCC3') // unchanged
  })

  it('duplicate Document No (Payment vs Contract share the index) → exactly one 409', async () => {
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const a = await receivedByDcc3('CT-2026-0204')
    const b = await receivedByDcc3('CT-2026-0205')
    const [ra, rb] = await Promise.all([
      dcc3.post(`/dcc3/tickets/${a}/send-accounting`).send({ documentNo: '26-CC-299-CT' }),
      dcc3.post(`/dcc3/tickets/${b}/send-accounting`).send({ documentNo: '26-CC-299-CT' }),
    ])
    expect([ra.status, rb.status].sort()).toEqual([201, 409])
    const dup = ra.status === 409 ? ra : rb
    expect(dup.body.code).toBe('DocumentNoDuplicate')
  })

  it('DCC1 cannot send to Accounting on the DCC3 route (403)', async () => {
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const id = await receivedByDcc3('CT-2026-0206')
    const res = await dcc1.post(`/dcc3/tickets/${id}/send-accounting`).send({ documentNo: '26-CC-206-CT' })
    expect(res.status).toBe(403)
  })

  it('cannot send twice — the ticket is closed after Sent to Accounting (409)', async () => {
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const id = await receivedByDcc3('CT-2026-0207')
    await dcc3.post(`/dcc3/tickets/${id}/send-accounting`).send({ documentNo: '26-CC-207-CT' })
    const again = await dcc3
      .post(`/dcc3/tickets/${id}/send-accounting`)
      .send({ documentNo: '26-CC-277-CT' })
    expect(again.status).toBe(409) // IllegalTransition — Sent to Accounting is terminal
  })
})
