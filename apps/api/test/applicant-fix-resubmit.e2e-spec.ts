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

/** Story 2.2 — Applicant confirms receipt, edits at Return-fixing (audited),
 *  and resubmits into a fresh Andy gate without losing history. */
describe('Applicant fix & resubmit (e2e)', () => {
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

  /** Drive a ticket to `Returned` (held by applicant) via a real DCC1 Return. */
  async function returnedTicket(): Promise<{ id: string; applicant: Agent }> {
    const applicant = await login('app-e2e', ['Applicant'])
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'sendBack', reason: 'Thiếu chữ ký' })
    return { id, applicant }
  }

  it('fields are LOCKED at Returned — PATCH is refused (409)', async () => {
    const { id, applicant } = await returnedTicket()
    const res = await applicant.patch(`/tickets/${id}`).send({ ...FIELDS, description: 'Hack' })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('FieldsLocked')
  })

  it('fields are EDITABLE at Submitted — still in the Pool, nobody picked it', async () => {
    const applicant = await login('app-e2e', ['Applicant'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    const res = await applicant.patch(`/tickets/${id}`).send({ ...FIELDS, description: 'Sửa khi ở Pool' })
    expect(res.status).toBe(200)
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.description).toBe('Sửa khi ở Pool')
    expect(row.status).toBe('Submitted')
  })

  it('editing documentType across a flow boundary keeps flow in sync', async () => {
    const applicant = await login('app-e2e', ['Applicant'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string // General → flow General
    expect((await admin.ticket.findUniqueOrThrow({ where: { id } })).flow).toBe('General')
    await applicant.patch(`/tickets/${id}`).send({ ...FIELDS, documentType: 'Payment' })
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.documentType).toBe('Payment')
    expect(row.flow).toBe('Payment') // recomputed, not stale 'General'
  })

  it('editing documentType to another flow at Return-fixing is REJECTED (code minted → flow immutable)', async () => {
    const { id, applicant } = await returnedTicket() // General, code minted, Returned
    expect((await applicant.post(`/tickets/${id}/confirm-return-receipt`)).status).toBe(201)
    const before = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(before.flow).toBe('General')
    expect(before.code).not.toBeNull()
    // Cross-flow Document Type change is refused once the code is minted — the code
    // encodes the flow (AD-5), so the type may only move within its own family (#2).
    // Prevents the General→Payment desync seen in the field (Image #28).
    const res = await applicant.patch(`/tickets/${id}`).send({ ...FIELDS, documentType: 'Payment' })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('FieldsLocked')
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.documentType).toBe('General') // unchanged — the edit was refused
    expect(row.flow).toBe('General')
  })

  it('confirm receipt → Return-fixing → edit (audited) → resubmit → Submitted', async () => {
    const { id, applicant } = await returnedTicket()

    // Phase 2: confirm hardcopy received.
    expect((await applicant.post(`/tickets/${id}/confirm-return-receipt`)).status).toBe(201)
    let row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Return-fixing')

    // Edit two fields — each change is one field_changed audit row (B6).
    expect(
      (await applicant.patch(`/tickets/${id}`).send({ ...FIELDS, description: 'Bổ sung chữ ký', amount: '2500' }))
        .status,
    ).toBe(200)
    const changed = await admin.ticketEvent.findMany({ where: { ticketId: id, action: 'field_changed' } })
    expect(changed.map((e) => (e.meta as { field: string }).field).sort()).toEqual(['amount', 'description'])
    row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.description).toBe('Bổ sung chữ ký')
    expect(row.amount).toBe(2500n)

    // Resubmit → back to Pool (Submitted), code preserved, history intact.
    expect((await applicant.post(`/tickets/${id}/resubmit`)).status).toBe(201)
    row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Submitted')
    expect(row.code).toMatch(/^G-\d{4}-0001$/) // mã giữ nguyên (AD-5)

    // Timeline continues — the old sendBack row is still there (append-only).
    const actions = (await admin.ticketEvent.findMany({ where: { ticketId: id } })).map((e) => e.action)
    expect(actions).toContain('sendBack')
    expect(actions).toContain('confirmReturnReceipt')
    expect(actions).toContain('resubmit')

    // A DCC1 picks it up again and re-runs the Andy gate this round; the code is
    // NOT re-minted (immutable across rounds, AD-5).
    const dcc = await login('dcc1-e2e', ['DCC1'])
    await dcc.post(`/dcc1/pool/${id}/pick`)
    const confirm = await dcc.post(`/dcc1/pool/${id}/confirm`)
    expect(confirm.body.status).toBe('Submitted to VP Andy')
    expect(confirm.body.code).toBe(row.code) // same code, no new mint
  })

  it('cannot overwrite the DCC2-assigned Contract No at Return-fixing (MED-1)', async () => {
    const applicant = await login('app-e2e', ['Applicant'])
    // A Contract ticket returned to the applicant AFTER DCC2 assigned its Contract No.
    const id = (
      await admin.ticket.create({
        data: {
          status: 'Return-fixing',
          flow: 'Contract',
          applicantSub: 'app-e2e',
          currentHolderSub: 'app-e2e',
          priority: 'normal',
          code: 'CT-2026-0001',
          roundNo: 1,
          documentType: 'Contract',
          description: 'HĐ',
          paymentTerm: 'N/A',
          contractNo: 'CT-ACC-42',
          projectTeam: 'Team A',
          currency: 'VND',
          amount: 1000n,
          budgetCode: 'BUD',
          contractor: 'ACME',
        },
      })
    ).id
    // Applicant PATCHes a DIFFERENT contractNo (bypassing the FE read-only field).
    const res = await applicant.patch(`/tickets/${id}`).send({
      ...FIELDS,
      documentType: 'Contract',
      description: 'HĐ sửa',
      contractNo: 'CT-HACK-99',
    })
    expect(res.status).toBe(200) // the legitimate field edit is accepted…
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.contractNo).toBe('CT-ACC-42') // …but the Contract No is pinned server-side
    expect(row.description).toBe('HĐ sửa')
    const changed = await admin.ticketEvent.findMany({ where: { ticketId: id, action: 'field_changed' } })
    expect(changed.map((e) => (e.meta as { field: string }).field)).not.toContain('contractNo')
  })

  it('another applicant cannot edit or resubmit my ticket (404)', async () => {
    const { id } = await returnedTicket()
    const intruder = await login('intruder', ['Applicant'])
    expect((await intruder.post(`/tickets/${id}/confirm-return-receipt`)).status).toBe(404)
    expect((await intruder.patch(`/tickets/${id}`).send(FIELDS)).status).toBe(404)
  })
})
