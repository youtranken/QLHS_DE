import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** H2 (walkthrough §C:83 / PRD §4.2) — the Payment counterpart of Contract AC4:
 *  DCC3 spots a wrong hardcopy at `Received by DCC3` → đẩy ngược DCC1 → DCC1 Returns.
 *  Heavy (past external processing) so it counts a round; DCC3 never Returns itself. */
describe('Payment DCC3 push-back → DCC1 Return (e2e)', () => {
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

  /** A Payment ticket already at `Received by DCC3`. */
  async function receivedByDcc3(code: string): Promise<string> {
    const t = await admin.ticket.create({
      data: {
        status: 'Received by DCC3',
        flow: 'Payment',
        applicantSub: 'app-e2e',
        currentHolderSub: 'dcc3-e2e',
        priority: 'normal',
        code,
        roundNo: 0,
      },
    })
    return t.id
  }

  it('DCC3 push-back flags the ticket, locks send-to-ACC; DCC1 return-pushback resolves it', async () => {
    const id = await receivedByDcc3('CT-2026-0301')
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const note = await dcc3.post(`/dcc3/tickets/${id}/request-return`).send({})
    expect(note.status).toBe(201)

    const flagged = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(flagged.reconcileFlag).toBe(true)
    expect(flagged.reconcileReason).toBe('return_requested')
    const noteRow = await admin.ticketEvent.findFirstOrThrow({
      where: { ticketId: id, action: 'return_requested' },
    })
    expect(noteRow.fromStatus).toBe(noteRow.toStatus) // status-preserving note

    // Closing is locked out while the return is pending.
    expect(
      (await dcc3.post(`/dcc3/tickets/${id}/send-accounting`).send({ documentNo: '26-CC-301-CT' }))
        .status,
    ).toBe(409)
    // DCC3 cannot Return itself, nor use DCC1's endpoint.
    expect((await dcc3.post(`/dcc1/tickets/${id}/return-pushback`).send({ reason: 'x' })).status).toBe(403)

    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    const ret = await dcc1.post(`/dcc1/tickets/${id}/return-pushback`).send({ reason: 'Bản cứng sai' })
    expect(ret.body.status).toBe('Returned')
    const row = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(row.roundNo).toBe(1) // heavy — already past external processing
    expect(row.reconcileFlag).toBe(false) // cleared atomically with the sendBack
    expect(row.reconcileReason).toBeNull()
  })

  it('DCC3 push-back is rejected before receipt (Submitted to DCC3) — wrong station (409)', async () => {
    const t = await admin.ticket.create({
      data: {
        status: 'Submitted to DCC3',
        flow: 'Payment',
        applicantSub: 'app-e2e',
        priority: 'normal',
        code: 'CT-2026-0302',
        roundNo: 0,
      },
    })
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const res = await dcc3.post(`/dcc3/tickets/${t.id}/request-return`).send({})
    expect(res.status).toBe(409)
  })

  it('DCC2 cannot push back on the DCC3 route (403)', async () => {
    const id = await receivedByDcc3('CT-2026-0303')
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    expect((await dcc2.post(`/dcc3/tickets/${id}/request-return`).send({})).status).toBe(403)
  })
})
