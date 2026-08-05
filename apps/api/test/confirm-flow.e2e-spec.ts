import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { FLOW, ROLE, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'
import { ConfirmFlowRepo } from '../src/infra/prisma/ticket/confirm-flow.repo'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

describe('DCC1 confirm-flow + code mint (e2e — AD-5/AD-14)', () => {
  let app: INestApplication
  let admin: PrismaClient
  let confirm: ConfirmFlowRepo

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
    confirm = app.get(ConfirmFlowRepo)
  })

  afterAll(async () => {
    await admin.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await admin.ticketLock.deleteMany({})
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
    await admin.numberCounter.deleteMany({})
  })

  async function seedSubmitted(): Promise<string> {
    const t = await admin.ticket.create({
      data: {
        status: TICKET_STATUS.Submitted,
        flow: FLOW.General,
        applicantSub: 'app-x',
        priority: 'normal',
      },
    })
    return t.id
  }

  const dcc1 = { sub: 'dcc1-a', activeRole: ROLE.Dcc1 }

  it('mints a code and moves to Submitted to VP Andy', async () => {
    const id = await seedSubmitted()
    const res = await confirm.confirm(id, dcc1, new Date())
    expect(res.code).toMatch(/^G-\d{4}-0001$/)
    expect(res.status).toBe(TICKET_STATUS.SubmittedToVpAndy)
    const t = await admin.ticket.findUniqueOrThrow({ where: { id } })
    expect(t.code).toBe(res.code)
    expect(t.status).toBe(TICKET_STATUS.SubmittedToVpAndy)
  })

  it('two concurrent confirms → two sequential codes, no dup/skip', async () => {
    const [a, b] = [await seedSubmitted(), await seedSubmitted()]
    const now = new Date()
    const [ra, rb] = await Promise.all([confirm.confirm(a, dcc1, now), confirm.confirm(b, dcc1, now)])
    const codes = [ra.code, rb.code].sort()
    expect(codes[0]).toMatch(/-0001$/)
    expect(codes[1]).toMatch(/-0002$/)
    expect(new Set(codes).size).toBe(2)
  })

  it('rolls back the counter on a failed confirm (no skipped number)', async () => {
    const id = await seedSubmitted()
    // Wrong role → transition throws AFTER the mint → whole tx (incl. counter) rolls back.
    await expect(
      confirm.confirm(id, { sub: 'x', activeRole: ROLE.Applicant }, new Date()),
    ).rejects.toThrow()
    // Next real confirm must still be ...0001 (the failed mint did not consume a number).
    const ok = await confirm.confirm(id, dcc1, new Date())
    expect(ok.code).toMatch(/-0001$/)
  })

  it('HTTP: DCC1 pick then confirm returns the code; applicant is forbidden', async () => {
    const id = await seedSubmitted()
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'dcc1-h', roles: ['DCC1'] })
    await agent.post(`/dcc1/pool/${id}/pick`)
    const res = await agent.post(`/dcc1/pool/${id}/confirm`)
    expect(res.status).toBe(201)
    expect(res.body.code).toMatch(/^G-\d{4}-0001$/)

    const other = await seedSubmitted()
    const applicant = request.agent(app.getHttpServer())
    await applicant.post('/auth/dev-login').send({ sub: 'app-h', roles: ['Applicant'] })
    expect((await applicant.post(`/dcc1/pool/${other}/confirm`)).status).toBe(403)
  })
})
