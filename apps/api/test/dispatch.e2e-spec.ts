import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { FLOW, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

describe('dispatch map — role×flow scope + IDOR (e2e, AD-16/AD-7/H4)', () => {
  let app: INestApplication
  let admin: PrismaClient

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
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

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  async function seed(flow: string): Promise<string> {
    const t = await admin.ticket.create({
      data: { status: TICKET_STATUS.Submitted, flow, applicantSub: 'a', priority: 'normal' },
    })
    return t.id
  }

  it('DCC1 sees all 3 flows; DCC2 only Contract; DCC3 only Payment', async () => {
    await seed(FLOW.General)
    await seed(FLOW.Contract)
    await seed(FLOW.Payment)

    const dcc1 = await (await login('d1', ['DCC1'])).get('/dispatch-map')
    expect(dcc1.body.map((l: { flow: string }) => l.flow).sort()).toEqual([
      'Contract',
      'General',
      'Payment',
    ])

    const dcc2 = await (await login('d2', ['DCC2'])).get('/dispatch-map')
    expect(dcc2.body.map((l: { flow: string }) => l.flow)).toEqual(['Contract'])

    const dcc3 = await (await login('d3', ['DCC3'])).get('/dispatch-map')
    expect(dcc3.body.map((l: { flow: string }) => l.flow)).toEqual(['Payment'])
  })

  it('Applicant has no dispatch map (403)', async () => {
    const applicant = await login('app', ['Applicant'])
    expect((await applicant.get('/dispatch-map')).status).toBe(403)
  })

  it('counts + SLA flag: an old Submitted ticket flags overdue', async () => {
    await admin.ticket.create({
      data: {
        status: TICKET_STATUS.Submitted,
        flow: FLOW.General,
        applicantSub: 'a',
        priority: 'normal',
        statusEnteredAt: new Date('2026-01-01T00:00:00Z'), // way past SLA=1
      },
    })
    const dcc1 = await (await login('d1', ['DCC1'])).get('/dispatch-map')
    const general = dcc1.body.find((l: { flow: string }) => l.flow === 'General')
    const pool = general.stations.find((s: { status: string }) => s.status === 'Submitted')
    expect(pool.count).toBe(1)
    expect(pool.overSla).toBe(true)
  })

  it('H4 IDOR: DCC2 deep-link to a Payment ticket → 404 (no leak)', async () => {
    const payment = await seed(FLOW.Payment)
    const dcc2 = await login('d2', ['DCC2'])
    expect((await dcc2.get(`/ticket/${payment}`)).status).toBe(404)
  })

  it('station popover is flow-scoped', async () => {
    await seed(FLOW.Payment)
    const dcc2 = await login('d2', ['DCC2'])
    const res = await dcc2.get(`/stations/${encodeURIComponent(TICKET_STATUS.Submitted)}/tickets`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([]) // Payment ticket invisible to DCC2
  })
})
