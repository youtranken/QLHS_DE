import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

describe('admin overview (N1, e2e)', () => {
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
    // Only clean rows this suite owns — NEVER slaConfig (migration-seeded baseline
    // that other suites + the app rely on; wiping it here broke sla-config.e2e).
    await db.ticketEvent.deleteMany({})
    await db.ticket.deleteMany({})
    await db.userRole.deleteMany({})
    await db.user.deleteMany({})
  })

  async function adminAgent() {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'sa-1', email: 'admin@test.local' })
    return agent
  }

  it('is Admin-only', async () => {
    const nobody = request.agent(app.getHttpServer())
    await nobody.post('/auth/dev-login').send({ sub: 'u-x', email: 'plain@test.local' })
    expect((await nobody.get('/admin/overview')).status).toBe(403)
  })

  it('derives running/overdue per line, today audit count, and system info', async () => {
    // Uses the migration-seeded ('Submitted','*',1) threshold — an ancient
    // statusEnteredAt is therefore overdue; a fresh one is on time.
    // An overdue Contract ticket + a fresh General ticket + a closed one (not running).
    const stale = new Date('2026-06-01T00:00:00.000Z')
    const overdue = await db.ticket.create({
      data: { status: 'Submitted', flow: 'Contract', applicantSub: 'a', code: 'CTR-1', statusEnteredAt: stale },
    })
    await db.ticket.create({ data: { status: 'Submitted', flow: 'General', applicantSub: 'a' } })
    await db.ticket.create({ data: { status: 'Completed', flow: 'Contract', applicantSub: 'a' } })
    // A ticket_event today (append-only; seeded via the owner connection).
    await db.ticketEvent.create({
      data: {
        ticketId: overdue.id,
        actorSub: 'a',
        action: 'created',
        fromStatus: 'Submitted',
        toStatus: 'Submitted',
        roundNo: 0,
      },
    })

    const agent = await adminAgent()
    const res = await agent.get('/admin/overview')
    expect(res.status).toBe(200)

    const b = res.body
    expect(b.runningTotal).toBe(2) // two Submitted; the Completed one is excluded
    expect(b.overdueTotal).toBeGreaterThanOrEqual(1)
    expect(b.lines).toHaveLength(3)
    const contract = b.lines.find((l: { flow: string }) => l.flow === 'Contract')
    expect(contract.running).toBe(1)
    expect(contract.overdue).toBe(1)
    expect(contract.onTimePct).toBe(0)

    expect(b.auditToday).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(b.recent)).toBe(true)
    expect(b.recent[0].code).toBe('CTR-1')
    expect(typeof b.users.total).toBe('number')
    expect(typeof b.mailPending).toBe('number')
    expect(typeof b.system.version).toBe('string')
    expect(typeof b.system.uptimeSeconds).toBe('number')
  })
})
