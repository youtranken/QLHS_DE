import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const PAYMENT_FIELDS = {
  documentType: 'Payment',
  description: 'Thanh toán đợt 1',
  paymentTerm: '30 ngày',
  contractNo: 'HD-PMT-001',
  projectTeam: 'Team C',
  currency: 'VND',
  amount: '3000000',
  budgetCode: 'BUD-PMT',
  contractor: 'ACME',
}

/** Story 4.1 — 2-phase handover DCC1 → DCC3 (AD-10, FR-13): forward to DCC3,
 *  DCC3 confirms hardcopy, "missing paper" bounce keeps custody at the sender. */
describe('Payment handover DCC1→DCC3 (e2e)', () => {
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

  /** Drive a Payment ticket to "Submitted to DCC3" (Andy approved → handover). */
  async function handedToDcc3(dcc: Agent): Promise<string> {
    const applicant = await login('app-e2e', ['Applicant'])
    const created = await applicant.post('/tickets').send(PAYMENT_FIELDS)
    const id = created.body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'handoverToDcc3' })
    return id
  }

  it('DCC1 hands an Andy-approved Payment to DCC3 → Submitted to DCC3', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc3(dcc)
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Submitted to DCC3')
    expect(row.currentHolderSub).toBeNull() // DCC3 inbox — no single holder yet
  })

  it('handover is flow-safe — a Contract ticket cannot fire handoverToDcc3', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const applicant = await login('app-e2e', ['Applicant'])
    const created = await applicant.post('/tickets').send({ ...PAYMENT_FIELDS, documentType: 'Contract' })
    const id = created.body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    const res = await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'handoverToDcc3' })
    expect(res.status).toBe(409) // IllegalTransition — no such edge in Contract
  })

  it('DCC3 confirms the hardcopy (with date) → Received by DCC3, audit meta', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc3(dcc)
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const res = await dcc3.post(`/dcc3/tickets/${id}/receive`).send({ receivedAt: '2026-07-12' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Received by DCC3')

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.currentHolderSub).toBe('dcc3-e2e')
    const last = await admin.ticketEvent.findFirstOrThrow({
      where: { ticketId: id, action: 'confirmReceivedByDcc3' },
    })
    expect((last.meta as { receivedFromDcc1At: string }).receivedFromDcc1At).toContain('2026-07-12')
  })

  it('DCC1 cannot confirm receipt — only DCC3 (403)', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc3(dcc)
    const res = await dcc.post(`/dcc3/tickets/${id}/receive`).send({})
    expect(res.status).toBe(403)
  })

  it('missing paper: flag set, status unchanged, custody stays at DCC1, audit note', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc3(dcc)
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const res = await dcc3.post(`/dcc3/tickets/${id}/missing-paper`).send({})
    expect(res.status).toBe(201)

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Submitted to DCC3') // no forward step
    expect(row.reconcileFlag).toBe(true)
    const note = await admin.ticketEvent.findFirstOrThrow({
      where: { ticketId: id, action: 'missing_paper_flagged' },
    })
    expect(note.fromStatus).toBe(note.toStatus) // status-preserving B6 note
  })

  it('DCC3 cannot confirm receipt while flagged for reconciliation (409)', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc3(dcc)
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    await dcc3.post(`/dcc3/tickets/${id}/missing-paper`).send({})
    const res = await dcc3.post(`/dcc3/tickets/${id}/receive`).send({})
    expect(res.status).toBe(409)
  })

  it('DCC1 re-hands over (missing_paper_cleared) → flag cleared, ready for DCC3 again', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc3(dcc)
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    await dcc3.post(`/dcc3/tickets/${id}/missing-paper`).send({})
    const resend = await dcc.post(`/dcc1/tickets/${id}/resend-dcc3`).send({})
    expect(resend.status).toBe(201)

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.reconcileFlag).toBe(false)
    expect(row.status).toBe('Submitted to DCC3')
    // now DCC3 can confirm
    const ok = await dcc3.post(`/dcc3/tickets/${id}/receive`).send({})
    expect(ok.body.status).toBe('Received by DCC3')
  })

  it('DCC1 Returns instead: missing-paper flag → return-pushback → Returned, new round (heavy)', async () => {
    // Item-1: the reconcile lane now gives Payment a Return path too. DCC3 flags a
    // missing/wrong hardcopy at receipt; DCC1 chooses Return over re-hand-over.
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc3(dcc)
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    await dcc3.post(`/dcc3/tickets/${id}/missing-paper`).send({ reason: 'Bản cứng sai — thiếu trang 3' })

    // DCC3 is never the Return actor (AD-11) — DCC1's endpoint refuses it (403).
    expect((await dcc3.post(`/dcc1/tickets/${id}/return-pushback`).send({ reason: 'x' })).status).toBe(403)

    const ret = await dcc.post(`/dcc1/tickets/${id}/return-pushback`).send({ reason: 'Bản cứng sai' })
    expect(ret.status).toBe(201)
    expect(ret.body.status).toBe('Returned')

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.roundNo).toBe(1) // heavy — new round for the Applicant to fix
    expect(row.reconcileFlag).toBe(false) // cleared atomically with the sendBack
    expect(row.reconcileReason).toBeNull()
    expect(row.currentHolderSub).toBe('app-e2e') // back with the Applicant
  })
})
