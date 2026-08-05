import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const FIELDS = {
  documentType: 'General',
  description: 'Xem thử',
  paymentTerm: 'N/A',
  contractNo: 'N/A',
  projectTeam: 'Team A',
  currency: 'VND',
  amount: '1000',
  budgetCode: 'BUD',
  contractor: 'ACME',
}

/** Story 5.3 — seen marker (AD-18): opening a ticket upserts a per-viewer view
 *  row; the "unseen >24h" flag on the list is derived at read time. */
describe('Seen marker & unseen >24h (e2e)', () => {
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
    await admin.ticketView.deleteMany({})
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
    await admin.numberCounter.deleteMany({})
  })

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  it('opening a ticket detail upserts a view row for that viewer (AC1)', async () => {
    const applicant = await login('app-seen', ['Applicant'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await applicant.get(`/ticket/${id}`)
    const row = await admin.ticketView.findUnique({
      where: { ticketId_viewerSub: { ticketId: id, viewerSub: 'app-seen' } },
    })
    expect(row).not.toBeNull()
  })

  it('re-opening only updates last_viewed_at (idempotent per (ticket, viewer))', async () => {
    const applicant = await login('app-seen', ['Applicant'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await applicant.get(`/ticket/${id}`)
    const first = await admin.ticketView.findUniqueOrThrow({
      where: { ticketId_viewerSub: { ticketId: id, viewerSub: 'app-seen' } },
    })
    await applicant.get(`/ticket/${id}`)
    const count = await admin.ticketView.count({ where: { ticketId: id, viewerSub: 'app-seen' } })
    expect(count).toBe(1) // one row, not two
    const second = await admin.ticketView.findUniqueOrThrow({
      where: { ticketId_viewerSub: { ticketId: id, viewerSub: 'app-seen' } },
    })
    expect(second.lastViewedAt.getTime()).toBeGreaterThanOrEqual(first.lastViewedAt.getTime())
  })

  it('an unviewed ticket older than 24h reads as unseen; viewing clears it (AC2)', async () => {
    const applicant = await login('app-seen', ['Applicant'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    // Age the arrival so the derived unseen signal fires.
    await admin.ticket.update({
      where: { id },
      data: { statusEnteredAt: new Date(Date.now() - 25 * 3600_000) },
    })

    const before = (await applicant.get('/tickets/mine')).body.find((t: { id: string }) => t.id === id)
    expect(before.unseen).toBe(true)

    await applicant.get(`/ticket/${id}`) // open → marks viewed now
    const after = (await applicant.get('/tickets/mine')).body.find((t: { id: string }) => t.id === id)
    expect(after.unseen).toBe(false)
  })

  it('a freshly-arrived ticket is NOT instantly unseen (AC4 — age since arrival)', async () => {
    const applicant = await login('app-seen', ['Applicant'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    const row = (await applicant.get('/tickets/mine')).body.find((t: { id: string }) => t.id === id)
    expect(row.unseen).toBe(false)
  })

  it('the seen state is server-side — a second session with the same sub agrees (AC3)', async () => {
    const s1 = await login('app-seen', ['Applicant'])
    const id = (await s1.post('/tickets').send(FIELDS)).body.id as string
    await admin.ticket.update({
      where: { id },
      data: { statusEnteredAt: new Date(Date.now() - 25 * 3600_000) },
    })
    await s1.get(`/ticket/${id}`) // viewed on device 1

    const s2 = await login('app-seen', ['Applicant']) // same sub, different session
    const row = (await s2.get('/tickets/mine')).body.find((t: { id: string }) => t.id === id)
    expect(row.unseen).toBe(false) // device 2 sees the same "seen" state
  })
})
