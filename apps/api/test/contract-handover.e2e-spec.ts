import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const CONTRACT_FIELDS = {
  documentType: 'Contract',
  description: 'Ký hợp đồng thi công',
  paymentTerm: '30 ngày',
  contractNo: 'HD-001',
  projectTeam: 'Team B',
  currency: 'VND',
  amount: '5000000',
  budgetCode: 'BUD-CT',
  contractor: 'ACME',
}

/** Story 3.1 — 2-phase handover DCC1 → DCC2 (AD-10, FR-10): forward to DCC2,
 *  DCC2 confirms hardcopy, "missing paper" bounce keeps custody at the sender. */
describe('Contract handover DCC1→DCC2 (e2e)', () => {
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

  /** Drive a Contract ticket to "Submitted to DCC2" (Andy approved → handover). */
  async function handedToDcc2(dcc: Agent): Promise<string> {
    const applicant = await login('app-e2e', ['Applicant'])
    const created = await applicant.post('/tickets').send(CONTRACT_FIELDS)
    const id = created.body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'handoverToDcc2' })
    return id
  }

  it('DCC1 hands an Andy-approved Contract to DCC2 → Submitted to DCC2', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc2(dcc)
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Submitted to DCC2')
    expect(row.currentHolderSub).toBeNull() // DCC2 pool — no single holder yet
  })

  it('handover is General/Payment-safe — a General ticket cannot fire it', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const applicant = await login('app-e2e', ['Applicant'])
    const created = await applicant.post('/tickets').send({ ...CONTRACT_FIELDS, documentType: 'General' })
    const id = created.body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    const res = await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'handoverToDcc2' })
    expect(res.status).toBe(409) // IllegalTransition — no such edge in General
  })

  it('DCC2 confirms the hardcopy (with date) → Received by DCC2, audit meta', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc2(dcc)
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const res = await dcc2.post(`/dcc2/tickets/${id}/receive`).send({ receivedAt: '2026-07-12' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Received by DCC2')

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.currentHolderSub).toBe('dcc2-e2e')
    const last = await admin.ticketEvent.findFirstOrThrow({
      where: { ticketId: id, action: 'confirmReceivedByDcc2' },
    })
    expect((last.meta as { receivedFromDcc1At: string }).receivedFromDcc1At).toContain('2026-07-12')
  })

  it('confirming receipt twice is idempotent-safe — the 2nd has no edge (409), audit not duplicated', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc2(dcc)
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const first = await dcc2.post(`/dcc2/tickets/${id}/receive`).send({})
    expect(first.status).toBe(201)
    expect(first.body.status).toBe('Received by DCC2')
    // A duplicate receipt (double-click / retry) must not re-fire the transition:
    // status is already "Received by DCC2", so confirmReceivedByDcc2 has no edge.
    const second = await dcc2.post(`/dcc2/tickets/${id}/receive`).send({})
    expect(second.status).toBe(409) // IllegalTransition
    // The append-only log holds exactly ONE confirm — the rolled-back 2nd left no trace.
    const events = await admin.ticketEvent.findMany({
      where: { ticketId: id, action: 'confirmReceivedByDcc2' },
    })
    expect(events).toHaveLength(1)
  })

  it('DCC1 cannot confirm receipt — only DCC2 (403)', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc2(dcc)
    const res = await dcc.post(`/dcc2/tickets/${id}/receive`).send({})
    expect(res.status).toBe(403)
  })

  it('missing paper: flag set, status unchanged, custody stays at DCC1, audit note', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc2(dcc)
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const res = await dcc2.post(`/dcc2/tickets/${id}/missing-paper`).send({})
    expect(res.status).toBe(201)

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Submitted to DCC2') // no forward step
    expect(row.reconcileFlag).toBe(true)
    const note = await admin.ticketEvent.findFirstOrThrow({
      where: { ticketId: id, action: 'missing_paper_flagged' },
    })
    expect(note.fromStatus).toBe(note.toStatus) // status-preserving B6 note
  })

  it('DCC2 cannot confirm receipt while flagged for reconciliation (409)', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc2(dcc)
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    await dcc2.post(`/dcc2/tickets/${id}/missing-paper`).send({})
    const res = await dcc2.post(`/dcc2/tickets/${id}/receive`).send({})
    expect(res.status).toBe(409)
  })

  it('DCC1 re-hands over (missing_paper_cleared) → flag cleared, ready for DCC2 again', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await handedToDcc2(dcc)
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    await dcc2.post(`/dcc2/tickets/${id}/missing-paper`).send({})
    const resend = await dcc.post(`/dcc1/tickets/${id}/resend-dcc2`).send({})
    expect(resend.status).toBe(201)

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.reconcileFlag).toBe(false)
    expect(row.status).toBe('Submitted to DCC2')
    // now DCC2 can confirm
    const ok = await dcc2.post(`/dcc2/tickets/${id}/receive`).send({})
    expect(ok.body.status).toBe('Received by DCC2')
  })
})
