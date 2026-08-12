import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** Batch send-to-Accounting pre-flight (POST /tickets/check-document-nos): which
 *  Document Nos are already taken, so the batch sheet flags a clash BEFORE sending.
 *  Mirrors the partial-unique index — a Cancelled ticket releases its number. */
describe('Document No pre-flight check (e2e)', () => {
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

  async function seed(status: string, code: string, documentNo: string): Promise<void> {
    await admin.ticket.create({
      data: { status, flow: 'Contract', applicantSub: 'app-e2e', priority: 'normal', code, documentNo, roundNo: 0 },
    })
  }

  it('returns only the taken numbers; a fresh one and a Cancelled ticket number are free', async () => {
    await seed('Submitted to Accounting', 'CT-2026-0001', 'DUP-1')
    await seed('Cancelled', 'CT-2026-0002', 'CANCELLED-1') // released number

    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const res = await dcc2
      .post('/tickets/check-document-nos')
      .send({ documentNos: ['DUP-1', 'CANCELLED-1', 'FRESH-1', '  DUP-1  '] })

    expect(res.status).toBe(200)
    expect([...res.body.existing].sort()).toEqual(['DUP-1'])
  })

  it('empty input → empty result (no DB hit needed)', async () => {
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const res = await dcc3.post('/tickets/check-document-nos').send({ documentNos: [] })
    expect(res.status).toBe(200)
    expect(res.body.existing).toEqual([])
  })

  it('DCC3 (Payment enterer) may also probe — uniqueness is global', async () => {
    await seed('Sent to Accounting', 'PM-2026-0001', 'PAY-9')
    const dcc3 = await login('dcc3-e2e', ['DCC3'])
    const res = await dcc3.post('/tickets/check-document-nos').send({ documentNos: ['PAY-9', 'PAY-X'] })
    expect(res.status).toBe(200)
    expect(res.body.existing).toEqual(['PAY-9'])
  })

  it('Admin may probe too (both boards)', async () => {
    await seed('Submitted to Accounting', 'CT-2026-0010', 'ADM-1')
    const adminAgent = await login('admin-e2e', ['Admin'])
    const res = await adminAgent.post('/tickets/check-document-nos').send({ documentNos: ['ADM-1', 'ADM-2'] })
    expect(res.status).toBe(200)
    expect(res.body.existing).toEqual(['ADM-1'])
  })

  it('rejects an over-cap array (>500) at the DTO (400)', async () => {
    const dcc2 = await login('dcc2-e2e', ['DCC2'])
    const tooMany = Array.from({ length: 501 }, (_, i) => `N-${i}`)
    const res = await dcc2.post('/tickets/check-document-nos').send({ documentNos: tooMany })
    expect(res.status).toBe(400)
  })

  it('an Applicant cannot probe Document Nos (403)', async () => {
    const applicant = await login('app-e2e', ['Applicant'])
    const res = await applicant.post('/tickets/check-document-nos').send({ documentNos: ['DUP-1'] })
    expect(res.status).toBe(403)
  })
})
