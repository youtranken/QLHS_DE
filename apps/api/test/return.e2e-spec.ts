import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const FIELDS = {
  documentType: 'General',
  description: 'Duyệt chi phí',
  paymentTerm: 'N/A',
  contractNo: 'N/A',
  projectTeam: 'Team A',
  currency: 'VND',
  amount: '1000',
  budgetCode: 'BUD',
  contractor: 'ACME',
}

/** Story 2.1 — DCC1 Return to Applicant (sendBack), reason required, custody
 *  reversal, and heavy-vs-light round counting. */
describe('DCC1 Return (e2e) — sendBack, reason, custody, round counting', () => {
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
    await admin.numberCounter.deleteMany({})
  })

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  async function createSubmittedToAndy(dcc: Agent): Promise<string> {
    const applicant = await login('app-e2e', ['Applicant'])
    const created = await applicant.post('/tickets').send(FIELDS)
    const id = created.body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    return id
  }

  it('rejects a Return without a reason (400 ReasonRequired)', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await createSubmittedToAndy(dcc)
    const res = await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'sendBack' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ReasonRequired')
  })

  it('light Return (Andy reject) → Returned, custody back to applicant, no round bump', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await createSubmittedToAndy(dcc)
    const res = await dcc
      .post(`/dcc1/tickets/${id}/action`)
      .send({ event: 'sendBack', reason: 'Thiếu chữ ký' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Returned')

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.currentHolderSub).toBe('app-e2e') // hardcopy handed back
    expect(row.roundNo).toBe(0) // light bounce — no new round

    const last = await admin.ticketEvent.findFirstOrThrow({
      where: { ticketId: id },
      orderBy: { occurredAt: 'desc' },
    })
    expect(last.action).toBe('sendBack')
    expect(last.reason).toBe('Thiếu chữ ký')
  })

  it('heavy Return (ACC return, Contract) counts a new round', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const t = await admin.ticket.create({
      data: {
        status: 'Received from ACC',
        flow: 'Contract',
        applicantSub: 'app-e2e',
        currentHolderSub: 'dcc1-e2e',
        priority: 'normal',
        code: 'CT-2026-0001',
        roundNo: 0,
      },
    })
    const res = await dcc
      .post(`/dcc1/tickets/${t.id}/action`)
      .send({ event: 'sendBack', reason: 'ACC trả lại bản cứng sai' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Returned')

    const row = await admin.ticket.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.roundNo).toBe(1) // entered external processing → counts
    expect(row.currentHolderSub).toBe('app-e2e')
  })

  it('DCC2 cannot use the DCC1 Return endpoint (403)', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await createSubmittedToAndy(dcc)
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const res = await dcc2
      .post(`/dcc1/tickets/${id}/action`)
      .send({ event: 'sendBack', reason: 'x' })
    expect(res.status).toBe(403)
  })
})
