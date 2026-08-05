import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { FLOW, ROLE, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** 2.2 — the notification bell: written by the transition trigger, read per-user
 *  with role-inbox auto-resolve, cleared personally. */
describe('notification center (e2e — 2.2)', () => {
  let app: INestApplication
  let db: PrismaClient

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await db.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
  })

  afterAll(async () => {
    await db.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await db.$executeRaw`DELETE FROM notification_read`
    await db.$executeRaw`DELETE FROM notification`
    await db.ticketEvent.deleteMany({})
    await db.ticket.deleteMany({})
    await db.userRole.deleteMany({})
    await db.user.deleteMany({})
  })

  async function agentAs(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  it('notifies the applicant when their ticket is returned', async () => {
    const applicant = await agentAs('applicant-1', [ROLE.Applicant])
    await db.ticket.create({
      data: { status: TICKET_STATUS.Returned, flow: FLOW.General, applicantSub: 'applicant-1', code: 'PMH-A-2026-0001' },
    })
    const res = await applicant.get('/notifications')
    expect(res.status).toBe(200)
    expect(res.body.unread).toBe(1)
    expect(res.body.items[0]).toMatchObject({ code: 'PMH-A-2026-0001', kind: TICKET_STATUS.Returned, read: false })
  })

  it('notifies the DCC2 role inbox on a two-phase handover arrival', async () => {
    const hoa = await agentAs('dcc2-hoa', [ROLE.Dcc2])
    await db.ticket.create({
      data: { status: TICKET_STATUS.SubmittedToDcc2, flow: FLOW.Contract, applicantSub: 'a', code: 'PMH-B-2026-0002' },
    })
    const res = await hoa.get('/notifications')
    expect(res.body.unread).toBe(1)
    expect(res.body.items[0]).toMatchObject({ code: 'PMH-B-2026-0002', read: false })
  })

  it('auto-resolves a role note for the WHOLE group once someone moves the ticket on', async () => {
    const hoa = await agentAs('dcc2-hoa', [ROLE.Dcc2])
    const nam = await agentAs('dcc2-nam', [ROLE.Dcc2])
    const t = await db.ticket.create({
      data: { status: TICKET_STATUS.SubmittedToDcc2, flow: FLOW.Contract, applicantSub: 'a', code: 'PMH-B-2026-0003' },
    })
    expect((await hoa.get('/notifications')).body.unread).toBe(1)
    expect((await nam.get('/notifications')).body.unread).toBe(1)

    // Hoa receives it — nobody read the bell, but the work is taken.
    await db.ticket.update({ where: { id: t.id }, data: { status: TICKET_STATUS.ReceivedByDcc2 } })

    expect((await hoa.get('/notifications')).body.unread).toBe(0)
    expect((await nam.get('/notifications')).body.unread).toBe(0)
  })

  it('one person reading does NOT clear the badge for the others', async () => {
    const hoa = await agentAs('dcc2-hoa', [ROLE.Dcc2])
    const nam = await agentAs('dcc2-nam', [ROLE.Dcc2])
    await db.ticket.create({
      data: { status: TICKET_STATUS.SubmittedToDcc2, flow: FLOW.Contract, applicantSub: 'a', code: 'PMH-B-2026-0004' },
    })
    await hoa.post('/notifications/read').expect(200)

    expect((await hoa.get('/notifications')).body.unread).toBe(0)
    expect((await nam.get('/notifications')).body.unread).toBe(1) // Nam still owed it
  })

  it('never shows one role inbox to another role', async () => {
    const dcc3 = await agentAs('dcc3-a', [ROLE.Dcc3])
    await db.ticket.create({
      data: { status: TICKET_STATUS.SubmittedToDcc2, flow: FLOW.Contract, applicantSub: 'a', code: 'PMH-B-2026-0005' },
    })
    expect((await dcc3.get('/notifications')).body.items).toHaveLength(0)
  })

  it('marks all read for the caller', async () => {
    const applicant = await agentAs('applicant-2', [ROLE.Applicant])
    await db.ticket.create({
      data: { status: TICKET_STATUS.Completed, flow: FLOW.General, applicantSub: 'applicant-2', code: 'PMH-A-2026-0006' },
    })
    expect((await applicant.get('/notifications')).body.unread).toBe(1)
    await applicant.post('/notifications/read').expect(200)
    expect((await applicant.get('/notifications')).body.unread).toBe(0)
  })

  it('requires a session', async () => {
    expect((await request(app.getHttpServer()).get('/notifications')).status).toBe(401)
  })
})
