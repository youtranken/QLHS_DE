import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** Story 2.3 — closed-tickets lookup: flow-scoped by role, filterable. */
describe('Closed tickets search (e2e)', () => {
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
    await seedClosed('G-2026-0001', 'General', 'ACME', 'HD-G-1')
    await seedClosed('CT-2026-0001', 'Contract', 'BUILDCO', 'HD-CT-1')
    await seedClosed('PM-2026-0001', 'Payment', 'ACME', 'HD-PM-1')
    // A non-closed Contract ticket must never appear in the closed lookup.
    await seedClosed('CT-2026-0002', 'Contract', 'BUILDCO', 'HD-CT-2', 'Submitted to VP Andy')
  })

  async function seedClosed(
    code: string,
    flow: string,
    contractor: string,
    contractNo: string,
    status = 'Completed',
  ): Promise<void> {
    await admin.ticket.create({
      data: { status, flow, applicantSub: 'app-a', priority: 'normal', code, contractor, contractNo },
    })
  }

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  // /tickets/closed now returns a keyset page {items, nextCursor}; read items.
  const codes = (body: { items: Array<{ code: string }> }) => body.items.map((t) => t.code).sort()

  it('DCC1 sees all three flows (Completed only)', async () => {
    const dcc = await login('dcc1', ['DCC1'])
    const res = await dcc.get('/tickets/closed')
    expect(res.status).toBe(200)
    expect(codes(res.body)).toEqual(['CT-2026-0001', 'G-2026-0001', 'PM-2026-0001'])
  })

  it('DCC2 is scoped to Contract, DCC3 to Payment (server-enforced)', async () => {
    const dcc2 = await login('dcc2', ['DCC2'])
    expect(codes((await dcc2.get('/tickets/closed')).body)).toEqual(['CT-2026-0001'])
    const dcc3 = await login('dcc3', ['DCC3'])
    expect(codes((await dcc3.get('/tickets/closed')).body)).toEqual(['PM-2026-0001'])
  })

  it('filters by contractor and by code', async () => {
    const dcc = await login('dcc1', ['DCC1'])
    expect(codes((await dcc.get('/tickets/closed?contractor=acme')).body)).toEqual([
      'G-2026-0001',
      'PM-2026-0001',
    ])
    expect(codes((await dcc.get('/tickets/closed?code=CT')).body)).toEqual(['CT-2026-0001'])
  })

  it('the "to" date bound is inclusive of the whole end day (created today is found)', async () => {
    const dcc = await login('dcc1', ['DCC1'])
    const today = new Date().toISOString().slice(0, 10) // seeded tickets were created just now
    const res = await dcc.get(`/tickets/closed?from=${today}&to=${today}`)
    expect(res.status).toBe(200)
    expect(codes(res.body)).toContain('G-2026-0001') // not excluded by a UTC-midnight upper bound
  })

  it('returns an empty list when nothing matches (web shows the try-fewer hint)', async () => {
    const dcc = await login('dcc1', ['DCC1'])
    const res = await dcc.get('/tickets/closed?contractor=NOPE')
    expect(res.body.items).toEqual([])
    expect(res.body.nextCursor).toBeNull()
  })

  it('an Applicant may not use the DCC lookup (403)', async () => {
    const app0 = await login('app-a', ['Applicant'])
    expect((await app0.get('/tickets/closed')).status).toBe(403)
  })

  it('rejects a datetime or garbage date filter with 400, not a leaked 500 (date-500)', async () => {
    const dcc = await login('dcc1', ['DCC1'])
    // A full ISO datetime used to concat to `${v}T00:00:00Z` → Invalid Date → Prisma 500.
    for (const bad of ['2026-07-25T10:00:00Z', 'yesterday', '2026-02-30']) {
      const res = await dcc.get(`/tickets/closed?from=${encodeURIComponent(bad)}`)
      expect(res.status).toBe(400)
    }
  })
})
