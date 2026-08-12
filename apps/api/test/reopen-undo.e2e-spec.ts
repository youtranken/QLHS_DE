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

/** Story 2.4 — reopen (no time limit) + DCC2/3 request-reopen + Undo (AD-19). */
describe('Reopen / request-reopen / undo (e2e)', () => {
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

  async function completedTicket(dcc: Agent): Promise<string> {
    const applicant = await login('app-e2e', ['Applicant'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'andyApproveComplete' })
    return id
  }

  it('reopen needs a reason (the chained sendBack), else 400', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await completedTicket(dcc)
    const res = await dcc.post(`/dcc1/tickets/${id}/reopen`).send({})
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ReasonRequired')
  })

  it('reopen is NOT fireable through the generic action endpoint (no stranding)', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await completedTicket(dcc)
    const res = await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'reopen' })
    expect(res.status).toBe(400) // rejected by the DTO whitelist
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Completed') // never stranded at Reopened
  })

  it('DCC1 reopens a Completed ticket (no time limit) → Returned, new round, code kept', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await completedTicket(dcc)
    // Simulate an old closure — reopen must still work (no thời hiệu).
    await admin.ticket.update({ where: { id }, data: { statusEnteredAt: new Date('2020-01-01') } })

    const res = await dcc.post(`/dcc1/tickets/${id}/reopen`).send({ reason: 'Sai số tiền' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Returned')

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.roundNo).toBe(1)
    expect(row.currentHolderSub).toBe('app-e2e')
    expect(row.code).toMatch(/^G-\d{4}-0001$/)
    const actions = (await admin.ticketEvent.findMany({ where: { ticketId: id } })).map((e) => e.action)
    expect(actions).toContain('reopen')
    expect(actions).toContain('sendBack')
  })

  it('DCC2 cannot reopen and the request-reopen endpoint is gone (reopening is DCC1 only)', async () => {
    const t = await admin.ticket.create({
      data: { status: 'Completed', flow: 'Contract', applicantSub: 'app-e2e', priority: 'normal', code: 'CT-2026-0001' },
    })
    const dcc2 = await login('dcc2-e2e', ['DCC2'])

    // Direct reopen is DCC1-only → 403.
    expect((await dcc2.post(`/dcc1/tickets/${t.id}/reopen`).send({ reason: 'x' })).status).toBe(403)
    // The old DCC2/DCC3 "request reopen" endpoint was retired → 404, no audit note.
    expect((await dcc2.post(`/dcc/tickets/${t.id}/request-reopen`)).status).toBe(404)

    const row = await admin.ticket.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.status).toBe('Completed') // unchanged
    expect(await admin.ticketEvent.count({ where: { action: 'reopen_requested' } })).toBe(0)
  })

  it('Undo reverses a reversible move (andyRequireBop) within the window', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const applicant = await login('app-e2e', ['Applicant'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    expect((await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'andyRequireBop', reason: 'Sếp yêu cầu trình BOP' })).body.status).toBe(
      'Submitted to BOP',
    )
    const undo = await dcc.post(`/dcc1/tickets/${id}/undo`)
    expect(undo.status).toBe(201)
    expect(undo.body.status).toBe('Submitted to VP Andy')

    // Append-only: the original andyRequireBop row is still present.
    const actions = (await admin.ticketEvent.findMany({ where: { ticketId: id } })).map((e) => e.action)
    expect(actions).toContain('andyRequireBop')
    expect(actions).toContain('undo')
  })

  it('Undo skips an interleaved audit note and still reverses the last transition', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const applicant = await login('app-e2e', ['Applicant'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'andyRequireBop', reason: 'Sếp yêu cầu trình BOP' })
    // A priority change lands AFTER the reversible move (a non-transition note).
    await dcc.patch(`/dcc1/tickets/${id}/priority`).send({ priority: 'urgent' })

    const undo = await dcc.post(`/dcc1/tickets/${id}/undo`)
    expect(undo.status).toBe(201)
    expect(undo.body.status).toBe('Submitted to VP Andy') // reversed the transition, not the note
  })

  it('Undo refuses an irreversible move (Completed) → 409', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await completedTicket(dcc)
    const res = await dcc.post(`/dcc1/tickets/${id}/undo`)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('NotReversible')
  })
})
