import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { firstValueFrom, filter, timeout } from 'rxjs'
import { FLOW, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { TicketNotifyListener } from '../src/infra/events/ticket-notify.listener'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/**
 * 2.1 — the whole real-time chain: a DB trigger NOTIFYs on a status writer, the
 * dedicated LISTEN connection receives it, and it surfaces on the RxJS stream the
 * SSE endpoint multicasts. Proven end to end against real Postgres.
 */
describe('ticket change notifications (e2e — 2.1)', () => {
  let app: INestApplication
  let admin: PrismaClient
  let listener: TicketNotifyListener
  const prev = process.env.QLHS_ENABLE_SSE

  beforeAll(async () => {
    process.env.QLHS_ENABLE_SSE = '1' // the suite disables crons/listeners by default
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    listener = app.get(TicketNotifyListener)
    await waitFor(() => listener.isListening)
  })

  afterAll(async () => {
    process.env.QLHS_ENABLE_SSE = prev
    await admin.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
  })

  it('emits a change when a new ticket is inserted', async () => {
    const received = firstValueFrom(listener.changes.pipe(timeout(4000)))
    const t = await admin.ticket.create({
      data: { status: TICKET_STATUS.Submitted, flow: FLOW.General, applicantSub: 'a', code: 'PMH-A-2026-9001' },
    })
    expect(await received).toEqual({ id: t.id, flow: FLOW.General, status: TICKET_STATUS.Submitted, applicantSub: 'a' })
  })

  it('emits a change when a ticket changes status, carrying the new status', async () => {
    const t = await admin.ticket.create({
      data: { status: TICKET_STATUS.Submitted, flow: FLOW.General, applicantSub: 'a', code: 'PMH-A-2026-9002' },
    })
    const received = firstValueFrom(
      listener.changes.pipe(
        filter((c) => c.id === t.id && c.status === TICKET_STATUS.SubmittedToDcc2),
        timeout(4000),
      ),
    )
    await admin.ticket.update({ where: { id: t.id }, data: { status: TICKET_STATUS.SubmittedToDcc2 } })
    expect((await received).status).toBe(TICKET_STATUS.SubmittedToDcc2)
  })

  it('stays silent when a non-status column changes — no needless refetch storm', async () => {
    const t = await admin.ticket.create({
      data: { status: TICKET_STATUS.Submitted, flow: FLOW.General, applicantSub: 'a', code: 'PMH-A-2026-9003' },
    })
    let fired = false
    const sub = listener.changes.subscribe(() => (fired = true))
    await admin.ticket.update({ where: { id: t.id }, data: { priority: 'urgent' } })
    await new Promise((r) => setTimeout(r, 300))
    sub.unsubscribe()
    expect(fired).toBe(false)
  })
})

async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('condition not met in time')
    await new Promise((r) => setTimeout(r, 25))
  }
}
