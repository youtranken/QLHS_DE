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

describe('General walking skeleton (e2e) — create → pick → confirm → Andy → Completed', () => {
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

  async function createSubmittedToAndy(dcc: Agent, over: Partial<typeof FIELDS> = {}): Promise<string> {
    const applicant = await login('app-e2e', ['Applicant'])
    const created = await applicant.post('/tickets').send({ ...FIELDS, ...over })
    const id = created.body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    return id
  }

  it('runs the whole General line to Completed with a full audit timeline', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await createSubmittedToAndy(dcc)

    const done = await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'andyApproveComplete' })
    expect(done.status).toBe(201)
    expect(done.body.status).toBe('Completed')

    const detail = await dcc.get(`/ticket/${id}`)
    expect(detail.body.isClosed).toBe(true)
    expect(detail.body.code).toMatch(/^G-\d{4}-0001$/)
    expect(detail.body.timeline.map((e: { action: string }) => e.action)).toEqual([
      'created',
      'pool_picked',
      'submitToAndy',
      'andyApproveComplete',
    ])
  })

  it('supports the Andy→BOP→Completed branch (General only)', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const id = await createSubmittedToAndy(dcc)
    expect((await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'andyRequireBop' })).body.status).toBe(
      'Submitted to BOP',
    )
    expect((await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'bopApprove' })).body.status).toBe(
      'Completed',
    )
  })

  it('batch approves independently (bad id fails, others succeed)', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const a = await createSubmittedToAndy(dcc)
    const b = await createSubmittedToAndy(dcc)
    const res = await dcc
      .post('/dcc1/tickets/action')
      .send({ ticketIds: [a, b, 'ghost'], event: 'andyApproveComplete' })
    const byId: Record<string, { ok: boolean }> = Object.fromEntries(
      res.body.map((r: { id: string }) => [r.id, r]),
    )
    expect(byId[a]?.ok).toBe(true)
    expect(byId[b]?.ok).toBe(true)
    expect(byId['ghost']?.ok).toBe(false)
  })

  it('legal-actions: kèm-BOP offered for General, not for Contract (AD-17)', async () => {
    const dcc = await login('dcc1-e2e', ['DCC1'])
    const gen = await createSubmittedToAndy(dcc)
    const genActions = (await dcc.get(`/ticket/${gen}`)).body.actions.map((a: { event: string }) => a.event)
    expect(genActions).toContain('andyRequireBop')

    const ct = await admin.ticket.create({
      data: {
        status: 'Submitted to VP Andy',
        flow: 'Contract',
        applicantSub: 'a',
        priority: 'normal',
        code: 'CT-2026-9999',
      },
    })
    const ctActions = (await dcc.get(`/ticket/${ct.id}`)).body.actions.map((a: { event: string }) => a.event)
    expect(ctActions).not.toContain('andyRequireBop')
  })
})
