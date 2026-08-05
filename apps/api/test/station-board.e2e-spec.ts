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

describe('DCC station board (e2e — AD-17 actions + scope)', () => {
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
    await admin.ticketLock.deleteMany({})
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
  })

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  // Single-step gate: a Pool card offers "Nhận" (__confirm → mint code + advance)
  // and Return (F12 duplicate, wrong doc type — FR-15). No separate pick step — the
  // Return is derived from the machine, hence the real event.
  it('DCC1 board has Pool/Andy/ACC/BOP columns; a Submitted card offers __confirm + sendBack', async () => {
    await admin.ticket.create({
      data: { status: TICKET_STATUS.Submitted, flow: FLOW.General, applicantSub: 'a', priority: 'normal' },
    })
    const dcc1 = await login('d1', ['DCC1'])
    const board = (await dcc1.get('/station-board')).body
    expect(board.map((c: { status: string }) => c.status)).toEqual([
      TICKET_STATUS.Submitted,
      TICKET_STATUS.SubmittedToVpAndy,
      TICKET_STATUS.SubmittedToAccounting, // "Chờ ACC" (AD-16)
      TICKET_STATUS.ReceivedFromAcc,
      TICKET_STATUS.SubmittedToBop,
    ])
    const pool = board.find((c: { status: string }) => c.status === TICKET_STATUS.Submitted)
    expect(pool.cards).toHaveLength(1)
    expect(pool.cards[0].actions.map((a: { event: string }) => a.event)).toEqual(['__confirm', 'sendBack'])
  })

  it('"Nhận" (__confirm) mints the code and advances Submitted → Submitted to VP Andy in one step', async () => {
    const t = await admin.ticket.create({
      data: { status: TICKET_STATUS.Submitted, flow: FLOW.General, applicantSub: 'a', priority: 'normal' },
    })
    const dcc1 = await login('d1', ['DCC1'])
    const res = await dcc1.post(`/dcc1/pool/${t.id}/confirm`).expect(201)
    expect(res.body.status).toBe(TICKET_STATUS.SubmittedToVpAndy)
    expect(res.body.code).toMatch(/^G-\d{4}-\d+$/) // General flow mints a G-<year>-<seq> code
    const after = await admin.ticket.findUnique({ where: { id: t.id } })
    expect(after?.status).toBe(TICKET_STATUS.SubmittedToVpAndy)
    expect(after?.code).toBe(res.body.code)
  })

  it('reconcile bounce: flagged Submitted-to-DCC2 leaves DCC2, appears on DCC1 with __resend', async () => {
    await admin.ticket.create({
      data: {
        status: TICKET_STATUS.SubmittedToDcc2,
        flow: FLOW.Contract,
        applicantSub: 'a',
        priority: 'normal',
        code: 'CT-2026-0001',
        reconcileFlag: true,
      },
    })
    const dcc2 = await login('d2', ['DCC2'])
    const dcc2Board = (await dcc2.get('/station-board')).body
    const dcc2Sub = dcc2Board.find(
      (c: { status: string }) => c.status === TICKET_STATUS.SubmittedToDcc2,
    )
    expect(dcc2Sub.cards).toHaveLength(0) // bounced off DCC2's lane

    const dcc1 = await login('d1', ['DCC1'])
    const dcc1Board = (await dcc1.get('/station-board')).body
    const reconcile = dcc1Board.find((c: { reconcile?: boolean }) => c.reconcile === true)
    expect(reconcile.cards).toHaveLength(1)
    expect(reconcile.cards[0].actions.map((a: { event: string }) => a.event)).toEqual(['__resend'])
  })

  it('push-back (return_requested) leaves DCC2 Hardcopy lane, shows on DCC1 with __return', async () => {
    await admin.ticket.create({
      data: {
        status: TICKET_STATUS.Hardcopy,
        flow: FLOW.Contract,
        applicantSub: 'a',
        priority: 'normal',
        code: 'CT-2026-0100',
        reconcileFlag: true,
        reconcileReason: 'return_requested',
      },
    })
    const dcc2 = await login('d2', ['DCC2'])
    const hardcopy = (await dcc2.get('/station-board')).body.find(
      (c: { status: string }) => c.status === TICKET_STATUS.Hardcopy,
    )
    expect(hardcopy.cards).toHaveLength(0) // pushed back — off DCC2's lane

    const dcc1 = await login('d1', ['DCC1'])
    const reconcile = (await dcc1.get('/station-board')).body.find(
      (c: { reconcile?: boolean }) => c.reconcile === true,
    )
    expect(reconcile.cards).toHaveLength(1)
    expect(reconcile.cards[0].actions.map((a: { event: string }) => a.event)).toEqual(['__return'])
  })

  it('an UN-flagged Submitted-to-DCC2 stays on DCC2 and is absent from DCC1', async () => {
    await admin.ticket.create({
      data: {
        status: TICKET_STATUS.SubmittedToDcc2,
        flow: FLOW.Contract,
        applicantSub: 'a',
        priority: 'normal',
        code: 'CT-2026-0002',
      },
    })
    const dcc2 = await login('d2', ['DCC2'])
    const dcc2Sub = (await dcc2.get('/station-board')).body.find(
      (c: { status: string }) => c.status === TICKET_STATUS.SubmittedToDcc2,
    )
    expect(dcc2Sub.cards).toHaveLength(1)

    const dcc1 = await login('d1', ['DCC1'])
    const reconcile = (await dcc1.get('/station-board')).body.find(
      (c: { reconcile?: boolean }) => c.reconcile === true,
    )
    expect(reconcile).toBeUndefined()
  })

  it('Applicant has no board (403)', async () => {
    const applicant = await login('app', ['Applicant'])
    expect((await applicant.get('/station-board')).status).toBe(403)
  })

  it('DCC1 adjusting priority on a missing ticket → 404, not a raw 500', async () => {
    const dcc1 = await login('d1', ['DCC1'])
    const res = await dcc1
      .patch('/dcc1/tickets/00000000-0000-0000-0000-000000000000/priority')
      .send({ priority: 'normal' })
    expect(res.status).toBe(404)
  })
})
