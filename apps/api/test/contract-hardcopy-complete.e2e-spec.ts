import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** Story 3.4 — BOP approved → Hardcopy (path scan) → Completed (FR-12, AD-10/15/11). */
describe('Contract BOP → Hardcopy → Completed (e2e)', () => {
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
        documentNo: `26-CC-${n}-CT`,
        roundNo: 0,
        ...extra,
      },
    })
  }

  it('BOP approved → DCC1 hands hardcopy back to DCC2', async () => {
    const { id } = await seed('Submitted to BOP', { currentHolderSub: 'dcc1-e2e' })
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const res = await dcc1.post(`/dcc1/tickets/${id}/action`).send({ event: 'bopApprove' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Submitted to DCC2 (Hardcopy)')
  })

  it('BOP rejected (sendBack) → Returned and counts a round (heavy)', async () => {
    const { id } = await seed('Submitted to BOP', { currentHolderSub: 'dcc1-e2e' })
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const res = await dcc1
      .post(`/dcc1/tickets/${id}/action`)
      .send({ event: 'sendBack', reason: 'BOP từ chối' })
    expect(res.body.status).toBe('Returned')
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.roundNo).toBe(1)
  })

  it('DCC2 confirms the hardcopy → Hardcopy', async () => {
    const { id } = await seed('Submitted to DCC2 (Hardcopy)')
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const res = await dcc2.post(`/dcc2/tickets/${id}/receive`).send({ receivedAt: '2026-07-12' })
    expect(res.body.status).toBe('Hardcopy')
  })

  it('missing paper at the hardcopy handover bounces to DCC1', async () => {
    const { id } = await seed('Submitted to DCC2 (Hardcopy)')
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const res = await dcc2.post(`/dcc2/tickets/${id}/missing-paper`).send({})
    expect(res.status).toBe(201)
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.reconcileFlag).toBe(true)
    expect(row.status).toBe('Submitted to DCC2 (Hardcopy)')
  })

  it('DCC2 enters the scan path and completes → Completed + outbox intent', async () => {
    const { id } = await seed('Hardcopy', { currentHolderSub: 'dcc2-e2e' })
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const res = await dcc2
      .post(`/dcc2/tickets/${id}/complete`)
      .send({ scanPath: '\\\\share\\scans\\CT-2026-0001.pdf' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Completed')

    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.scanPath).toContain('CT-2026')
    // AD-15: a Completed (Contract) email intent is written in the same tx.
    const outbox = await admin.notificationOutbox.findMany({ where: { ticketId: id } })
    expect(outbox).toHaveLength(1)
    expect(outbox[0]?.kind).toBe('Completed')
  })

  it('completing without a scan path is rejected (400)', async () => {
    const { id } = await seed('Hardcopy', { currentHolderSub: 'dcc2-e2e' })
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const res = await dcc2.post(`/dcc2/tickets/${id}/complete`).send({ scanPath: '   ' })
    expect(res.status).toBe(400)
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('Hardcopy')
  })

  it('AC4: DCC2 push-back flags the ticket, locks completion; DCC1 return-pushback resolves it', async () => {
    const { id } = await seed('Hardcopy', { currentHolderSub: 'dcc2-e2e' })
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const note = await dcc2.post(`/dcc2/tickets/${id}/request-return`).send({})
    expect(note.status).toBe(201)

    const flagged = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(flagged.reconcileFlag).toBe(true)
    expect(flagged.reconcileReason).toBe('return_requested')
    const noteRow = await admin.ticketEvent.findFirstOrThrow({
      where: { ticketId: id, action: 'return_requested' },
    })
    expect(noteRow.fromStatus).toBe(noteRow.toStatus) // status-preserving note

    // Completion is locked out while the return is pending (code-review #1).
    expect((await dcc2.post(`/dcc2/tickets/${id}/complete`).send({ scanPath: '\\\\s\\a.pdf' })).status).toBe(409)
    // DCC2 cannot Return itself, nor use DCC1's endpoint.
    expect((await dcc2.post(`/dcc1/tickets/${id}/return-pushback`).send({ reason: 'x' })).status).toBe(403)

    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const ret = await dcc1
      .post(`/dcc1/tickets/${id}/return-pushback`)
      .send({ reason: 'Bản cứng sai' })
    expect(ret.body.status).toBe('Returned')
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.roundNo).toBe(1) // heavy — already past external processing
    expect(row.reconcileFlag).toBe(false) // cleared atomically with the sendBack
    expect(row.reconcileReason).toBeNull()
  })

  it('return-pushback requires a reason (400) and refuses an un-flagged ticket (409)', async () => {
    const { id } = await seed('Hardcopy', { currentHolderSub: 'dcc2-e2e' })
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    expect((await dcc1.post(`/dcc1/tickets/${id}/return-pushback`).send({ reason: ' ' })).status).toBe(400)
    expect((await dcc1.post(`/dcc1/tickets/${id}/return-pushback`).send({ reason: 'x' })).status).toBe(409)
  })
})
