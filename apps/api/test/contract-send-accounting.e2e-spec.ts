import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** Story 3.2 — DCC2 enters a unique Document No and sends to Accounting
 *  (FR-11, AD-20). Format is an early DTO layer; the DB partial-unique index is
 *  the final TOCTOU guard (M5, shared with Payment). */
describe('Contract Document No + send to Accounting (e2e)', () => {
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

  /** A Contract ticket already at `Received by DCC2`. */
  async function receivedByDcc2(code: string): Promise<string> {
    const t = await admin.ticket.create({
      data: {
        status: 'Received by DCC2',
        flow: 'Contract',
        applicantSub: 'app-e2e',
        currentHolderSub: 'dcc2-e2e',
        priority: 'normal',
        code,
        roundNo: 0,
      },
    })
    return t.id
  }

  it('valid Document No → Submitted to Accounting, persisted + dated', async () => {
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const id = await receivedByDcc2('CT-2026-0001')
    const res = await dcc2
      .post(`/dcc2/tickets/${id}/send-accounting`)
      .send({ documentNo: '26-CC-01-CT' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Submitted to Accounting')

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.documentNo).toBe('26-CC-01-CT')
    // Submitted to Accounting is a DCC1-owned "Chờ ACC" queue; sent BY DCC2 →
    // no single holder until DCC1 receives it back (AD-16, role-aware holder).
    expect(row.currentHolderSub).toBeNull()
    const ev = await admin.ticketEvent.findFirstOrThrow({
      where: { ticketId: id, action: 'sendToAccounting' },
    })
    expect((ev.meta as { documentNo: string }).documentNo).toBe('26-CC-01-CT')
  })

  it('accepts a free-form Document No (any non-empty value)', async () => {
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const id = await receivedByDcc2('CT-2026-0002')
    const res = await dcc2.post(`/dcc2/tickets/${id}/send-accounting`).send({ documentNo: 'HD-2026/ABC-123' })
    expect(res.status).toBe(201)
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.documentNo).toBe('HD-2026/ABC-123')
  })

  it('rejects an empty Document No (400) before touching the DB', async () => {
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const id = await receivedByDcc2('CT-2026-0002')
    const res = await dcc2.post(`/dcc2/tickets/${id}/send-accounting`).send({ documentNo: '   ' })
    expect(res.status).toBe(400)
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Received by DCC2') // unchanged
  })

  it('duplicate Document No across two tickets → exactly one 409 (DB UNIQUE)', async () => {
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const a = await receivedByDcc2('CT-2026-0003')
    const b = await receivedByDcc2('CT-2026-0004')
    const [ra, rb] = await Promise.all([
      dcc2.post(`/dcc2/tickets/${a}/send-accounting`).send({ documentNo: '26-CC-99-CT' }),
      dcc2.post(`/dcc2/tickets/${b}/send-accounting`).send({ documentNo: '26-CC-99-CT' }),
    ])
    const codes = [ra.status, rb.status].sort()
    expect(codes).toEqual([201, 409])
    const dup = ra.status === 409 ? ra : rb
    expect(dup.body.code).toBe('DocumentNoDuplicate')
  })

  it('a Cancelled ticket does not block reuse of its Document No (M5 partial unique)', async () => {
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    await admin.ticket.create({
      data: {
        status: 'Cancelled',
        flow: 'Contract',
        applicantSub: 'app-e2e',
        priority: 'normal',
        code: 'CT-2026-0005',
        documentNo: '26-CC-55-CT',
      },
    })
    const id = await receivedByDcc2('CT-2026-0006')
    const res = await dcc2
      .post(`/dcc2/tickets/${id}/send-accounting`)
      .send({ documentNo: '26-CC-55-CT' })
    expect(res.status).toBe(201)
  })

  it('DCC1 cannot send to Accounting (403)', async () => {
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const id = await receivedByDcc2('CT-2026-0007')
    const res = await dcc1.post(`/dcc2/tickets/${id}/send-accounting`).send({ documentNo: '26-CC-07-CT' })
    expect(res.status).toBe(403)
  })

  it('cannot send twice — DCC2 fields freeze after Accounting (409, no edge)', async () => {
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const id = await receivedByDcc2('CT-2026-0008')
    await dcc2.post(`/dcc2/tickets/${id}/send-accounting`).send({ documentNo: '26-CC-08-CT' })
    const again = await dcc2
      .post(`/dcc2/tickets/${id}/send-accounting`)
      .send({ documentNo: '26-CC-88-CT' })
    expect(again.status).toBe(409)
  })
})
