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

describe('GET /ticket/:id (H4 IDOR — role required, no existence leak)', () => {
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

  async function aTicket(applicantSub: string): Promise<string> {
    const t = await admin.ticket.create({
      data: { status: TICKET_STATUS.Submitted, flow: FLOW.General, applicantSub, priority: 'normal' },
    })
    return t.id
  }

  it('lets the owning applicant read their own ticket', async () => {
    const id = await aTicket('a')
    const applicantA = await login('a', ['Applicant'])
    expect((await applicantA.get(`/ticket/${id}`)).status).toBe(200)
  })

  it('treats an unappointed user as a baseline Applicant — a non-owner sees 404, not the ticket', async () => {
    // Every PMH ID login is at least an Applicant (effectiveRoles); a non-owner
    // Applicant gets the same 404 hide as any other applicant, not an exists oracle.
    const id = await aTicket('a')
    const nobody = await login('nobody', [])
    expect((await nobody.get(`/ticket/${id}`)).status).toBe(404)
  })

  it("hides another applicant's ticket as 404 (no exists-but-forbidden oracle)", async () => {
    const id = await aTicket('a')
    const applicantB = await login('b', ['Applicant'])
    expect((await applicantB.get(`/ticket/${id}`)).status).toBe(404)
  })

  it('lets an Admin read ANY ticket (oversight) — but with no action buttons', async () => {
    const id = await aTicket('a') // owned by applicant 'a'
    const boss = await login('boss', ['Admin'])
    const res = await boss.get(`/ticket/${id}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(id)
    // Admin is read-only oversight: sees everything, acts on nothing here.
    expect(res.body.actions).toEqual([])
  })

  it('opens a ticket by its human code, not only its UUID (deep-link by code)', async () => {
    const t = await admin.ticket.create({
      data: { status: TICKET_STATUS.Submitted, flow: FLOW.General, applicantSub: 'a', priority: 'normal', code: 'G-2026-0009' },
    })
    const applicantA = await login('a', ['Applicant'])
    const res = await applicantA.get('/ticket/G-2026-0009')
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(t.id)
    expect(res.body.code).toBe('G-2026-0009')
  })

  it('still hides a by-code deep-link to another applicant’s ticket (404, H4)', async () => {
    await admin.ticket.create({
      data: { status: TICKET_STATUS.Submitted, flow: FLOW.General, applicantSub: 'a', priority: 'normal', code: 'G-2026-0010' },
    })
    const applicantB = await login('b', ['Applicant'])
    expect((await applicantB.get('/ticket/G-2026-0010')).status).toBe(404)
  })
})
