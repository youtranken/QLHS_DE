import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

describe('admin audit viewer (N2, e2e)', () => {
  let app: INestApplication
  let db: PrismaClient

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await db.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
  })

  afterAll(async () => {
    await db.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await db.ticketEvent.deleteMany({})
    await db.ticket.deleteMany({})
    await db.user.deleteMany({})
    await db.userRole.deleteMany({})
  })

  async function adminAgent() {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'sa-1', email: 'admin@test.local' })
    return agent
  }

  async function seed() {
    const t = await db.ticket.create({
      data: { status: 'Submitted', flow: 'Contract', applicantSub: 'a', code: 'CTR-77' },
    })
    await db.user.create({ data: { sub: 'a', email: 'a@x', fullName: 'Anh A' } })
    const ev = (action: string, actorSub: string) => ({
      ticketId: t.id,
      actorSub,
      action,
      fromStatus: 'Submitted',
      toStatus: 'Submitted',
      roundNo: 0,
    })
    await db.ticketEvent.createMany({
      data: [ev('created', 'a'), ev('pool_picked', 'a'), ev('sendBack', 'b')],
    })
    return t
  }

  it('is Admin-only', async () => {
    const nobody = request.agent(app.getHttpServer())
    await nobody.post('/auth/dev-login').send({ sub: 'u-x', email: 'plain@test.local' })
    expect((await nobody.get('/admin/audit')).status).toBe(403)
  })

  it('returns paginated events newest-first with resolved actor names + today stats', async () => {
    await seed()
    const agent = await adminAgent()
    const res = await agent.get('/admin/audit')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.events).toHaveLength(3)
    // actor name resolved from the directory (sub → fullName)
    const created = res.body.events.find((e: { action: string }) => e.action === 'created')
    expect(created.actorName).toBe('Anh A')
    expect(created.code).toBe('CTR-77')
    // today's per-event breakdown is present
    expect(res.body.today.map((t: { action: string }) => t.action)).toContain('sendBack')
  })

  it('filters by event and by ticket code', async () => {
    await seed()
    const agent = await adminAgent()

    const byEvent = await agent.get('/admin/audit').query({ event: 'sendBack' })
    expect(byEvent.body.total).toBe(1)
    expect(byEvent.body.events[0].action).toBe('sendBack')

    const byCode = await agent.get('/admin/audit').query({ code: 'ctr-77' }) // case-insensitive
    expect(byCode.body.total).toBe(3)

    const noMatch = await agent.get('/admin/audit').query({ code: 'ZZZ' })
    expect(noMatch.body.total).toBe(0)
    expect(noMatch.body.totalPages).toBe(1)
  })

  it('breaks occurredAt ties by id desc so pages never dup/skip (M3)', async () => {
    // Events sharing one instant would order arbitrarily without a tiebreaker →
    // rows shuffle between page 1 and 2 (dup/skip). The id (BigInt, monotonic) is
    // the deterministic newest-first tiebreaker.
    const t = await db.ticket.create({
      data: { status: 'Submitted', flow: 'General', applicantSub: 'a', code: 'TIE-1' },
    })
    const at = new Date('2026-07-20T03:00:00.000Z')
    await db.ticketEvent.createMany({
      data: Array.from({ length: 6 }, () => ({
        ticketId: t.id,
        actorSub: 'a',
        action: 'created',
        fromStatus: 'Submitted',
        toStatus: 'Submitted',
        roundNo: 0,
        occurredAt: at,
      })),
    })
    const agent = await adminAgent()
    const res = await agent.get('/admin/audit').query({ code: 'TIE-1' })
    const ids = res.body.events.map((e: { id: string }) => BigInt(e.id))
    const descending = [...ids].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    expect(ids).toEqual(descending)
  })

  it('rejects a malformed date filter with 400, not a leaked 500 (date-500)', async () => {
    const agent = await adminAgent()
    for (const bad of ['not-a-date', '2026-13-01', '2026-07-25T10:00:00Z']) {
      const res = await agent.get('/admin/audit').query({ from: bad })
      expect(res.status).toBe(400)
    }
  })

  it('accepts a well-formed day filter (YYYY-MM-DD)', async () => {
    await seed()
    const agent = await adminAgent()
    const res = await agent.get('/admin/audit').query({ from: '2000-01-01', to: '2999-12-31' })
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
  })
})
