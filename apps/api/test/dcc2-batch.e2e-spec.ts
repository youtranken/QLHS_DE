import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** DCC2 bulk hardcopy close: confirm-receipt of many, complete many, and the
 *  FE "Hoàn tất luôn" chain (confirm → complete). Each ticket is independent, and
 *  complete still writes the Applicant email intent per ticket (AD-15). */
describe('DCC2 bulk hardcopy (e2e)', () => {
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
    await admin.notificationOutbox.deleteMany({})
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
        flow: 'Contract',
        applicantSub: 'app-e2e',
        currentHolderSub: null,
        priority: 'normal',
        code: `CT-2026-${n}`,
        contractNo: `26-CC-${n}-CT`,
        roundNo: 0,
        ...extra,
      },
    })
  }

  it('bulk confirm-receipt moves every Submitted-to-DCC2(Hardcopy) ticket to Hardcopy', async () => {
    const a = await seed('Submitted to DCC2 (Hardcopy)')
    const b = await seed('Submitted to DCC2 (Hardcopy)')
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const res = await dcc2
      .post('/dcc2/tickets/action')
      .send({ ticketIds: [a.id, b.id], event: 'confirmReceivedByDcc2' })
    expect(res.status).toBe(201)
    expect(res.body.every((r: { ok: boolean }) => r.ok)).toBe(true)
    for (const { id } of [a, b]) {
      expect((await admin.ticket.findUniqueOrThrow({ where: { id } })).status).toBe('Hardcopy')
    }
  })

  it('bulk complete closes every Hardcopy ticket + writes one email intent each (AD-15)', async () => {
    const a = await seed('Hardcopy', { currentHolderSub: 'dcc2-e2e' })
    const b = await seed('Hardcopy', { currentHolderSub: 'dcc2-e2e' })
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const res = await dcc2
      .post('/dcc2/tickets/action')
      .send({ ticketIds: [a.id, b.id], event: 'completeContract' })
    expect(res.status).toBe(201)
    expect(res.body.map((r: { status: string }) => r.status)).toEqual(['Completed', 'Completed'])
    for (const { id } of [a, b]) {
      const outbox = await admin.notificationOutbox.findMany({ where: { ticketId: id } })
      expect(outbox.map((o) => o.kind)).toEqual(['Completed'])
    }
  })

  it('"Hoàn tất luôn" chain: confirm then complete leaves every ticket Completed', async () => {
    const a = await seed('Submitted to DCC2 (Hardcopy)')
    const b = await seed('Submitted to DCC2 (Hardcopy)')
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const ids = [a.id, b.id]
    const confirm = await dcc2.post('/dcc2/tickets/action').send({ ticketIds: ids, event: 'confirmReceivedByDcc2' })
    expect(confirm.body.every((r: { ok: boolean }) => r.ok)).toBe(true)
    const complete = await dcc2.post('/dcc2/tickets/action').send({ ticketIds: ids, event: 'completeContract' })
    expect(complete.body.every((r: { status: string }) => r.status === 'Completed')).toBe(true)
  })

  it('each ticket is independent — a flagged (reconcile) one fails, the rest still confirm', async () => {
    const ok = await seed('Submitted to DCC2 (Hardcopy)')
    const flagged = await seed('Submitted to DCC2 (Hardcopy)', { reconcileFlag: true, reconcileReason: 'missing_paper' })
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const res = await dcc2
      .post('/dcc2/tickets/action')
      .send({ ticketIds: [ok.id, flagged.id], event: 'confirmReceivedByDcc2' })
    const byId = new Map(res.body.map((r: { id: string; ok: boolean }) => [r.id, r.ok]))
    expect(byId.get(ok.id)).toBe(true)
    expect(byId.get(flagged.id)).toBe(false)
    expect((await admin.ticket.findUniqueOrThrow({ where: { id: flagged.id } })).status).toBe(
      'Submitted to DCC2 (Hardcopy)',
    )
  })

  it('DCC1 cannot drive the DCC2 batch (403); an unknown event is rejected (400)', async () => {
    const { id } = await seed('Hardcopy')
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    expect((await dcc1.post('/dcc2/tickets/action').send({ ticketIds: [id], event: 'completeContract' })).status).toBe(403)
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    expect((await dcc2.post('/dcc2/tickets/action').send({ ticketIds: [id], event: 'sendBack' })).status).toBe(400)
  })
})
