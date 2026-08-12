import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** DCC3 bulk hardcopy confirm (Payment) — symmetric to DCC2, confirm-only. */
describe('DCC3 bulk hardcopy confirm (e2e)', () => {
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
  })

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  let seq = 0
  function seed(status: string, extra: Record<string, unknown> = {}): Promise<{ id: string }> {
    seq += 1
    const n = String(seq).padStart(4, '0')
    return admin.ticket.create({
      data: {
        status,
        flow: 'Payment',
        applicantSub: 'app-e2e',
        currentHolderSub: null,
        priority: 'normal',
        code: `PM-2026-${n}`,
        contractNo: `HD-REF-${n}`,
        roundNo: 0,
        ...extra,
      },
    })
  }

  it('bulk confirm moves every Submitted-to-DCC3 ticket to Received by DCC3', async () => {
    const a = await seed('Submitted to DCC3')
    const b = await seed('Submitted to DCC3')
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const res = await dcc3
      .post('/dcc3/tickets/action')
      .send({ ticketIds: [a.id, b.id], event: 'confirmReceivedByDcc3' })
    expect(res.status).toBe(201)
    expect(res.body.map((r: { status: string }) => r.status)).toEqual(['Received by DCC3', 'Received by DCC3'])
    for (const { id } of [a, b]) {
      expect((await admin.ticket.findUniqueOrThrow({ where: { id } })).status).toBe('Received by DCC3')
    }
  })

  it('each ticket independent — a flagged one fails, the rest still confirm', async () => {
    const ok = await seed('Submitted to DCC3')
    const flagged = await seed('Submitted to DCC3', { reconcileFlag: true, reconcileReason: 'missing_paper' })
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const res = await dcc3
      .post('/dcc3/tickets/action')
      .send({ ticketIds: [ok.id, flagged.id], event: 'confirmReceivedByDcc3' })
    const byId = new Map(res.body.map((r: { id: string; ok: boolean }) => [r.id, r.ok]))
    expect(byId.get(ok.id)).toBe(true)
    expect(byId.get(flagged.id)).toBe(false)
  })

  it('DCC2 cannot drive the DCC3 batch (403); an unknown event is rejected (400)', async () => {
    const { id } = await seed('Submitted to DCC3')
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    expect((await dcc2.post('/dcc3/tickets/action').send({ ticketIds: [id], event: 'confirmReceivedByDcc3' })).status).toBe(403)
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    expect((await dcc3.post('/dcc3/tickets/action').send({ ticketIds: [id], event: 'completeContract' })).status).toBe(400)
  })
})
