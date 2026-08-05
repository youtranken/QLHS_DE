import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

const FIELDS = {
  documentType: 'General',
  description: 'Xin duyệt chi phí',
  paymentTerm: 'N/A',
  contractNo: 'N/A',
  projectTeam: 'Team A',
  currency: 'VND',
  amount: '5000000',
  budgetCode: 'BUD-1',
  contractor: 'N/A',
}

describe('applicant ticket (e2e — CAP-1)', () => {
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
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
  })

  async function applicant() {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'app-e2e', roles: ['Applicant'] })
    return agent
  }

  it('creates a ticket → Submitted, code NULL, round 0, mapped flow, amount preserved', async () => {
    const agent = await applicant()
    const res = await agent.post('/tickets').send(FIELDS)
    expect(res.status).toBe(201)
    const mine = await agent.get('/tickets/mine')
    const t = mine.body.find((x: { id: string }) => x.id === res.body.id)
    expect(t.status).toBe('Submitted')
    expect(t.code).toBeNull()
    expect(t.roundNo).toBe(0)
    expect(t.flow).toBe('General')
    expect(t.amount).toBe('5000000')
  })

  it('blocks a missing field (400)', async () => {
    const agent = await applicant()
    const { description, ...missing } = FIELDS
    void description
    const res = await agent.post('/tickets').send(missing)
    expect(res.status).toBe(400)
  })

  it('strips an attempted attachment field (no file attachments by design)', async () => {
    const agent = await applicant()
    const res = await agent.post('/tickets').send({ ...FIELDS, attachment: 'evil.pdf' })
    expect(res.status).toBe(201)
    const mine = await agent.get('/tickets/mine')
    const t = mine.body.find((x: { id: string }) => x.id === res.body.id)
    expect('attachment' in t).toBe(false)
  })

  it('clones only the 9 fields (new ticket clean: code NULL)', async () => {
    const agent = await applicant()
    const src = await agent.post('/tickets').send({ ...FIELDS, documentType: 'Contract' })
    const clone = await agent.post(`/tickets/from/${src.body.id}`).send({})
    expect(clone.status).toBe(201)
    const mine = await agent.get('/tickets/mine')
    const c = mine.body.find((x: { id: string }) => x.id === clone.body.id)
    expect(c.code).toBeNull()
    expect(c.flow).toBe('Contract')
    expect(c.documentType).toBe('Contract')
  })

  it('cancels while Submitted → Cancelled', async () => {
    const agent = await applicant()
    const res = await agent.post('/tickets').send(FIELDS)
    const cancel = await agent.post(`/tickets/${res.body.id}/cancel`)
    expect(cancel.status).toBe(201)
    const mine = await agent.get('/tickets/mine')
    const t = mine.body.find((x: { id: string }) => x.id === res.body.id)
    expect(t.status).toBe('Cancelled')
  })

  it('forbids a non-applicant role from creating (403)', async () => {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'dcc1-e2e', roles: ['DCC1'] })
    const res = await agent.post('/tickets').send(FIELDS)
    expect(res.status).toBe(403)
  })
})
