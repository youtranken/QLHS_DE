import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

describe('admin options CRUD (N3, e2e)', () => {
  let app: INestApplication
  let db: PrismaClient

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await db.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
  })

  afterAll(async () => {
    await db.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await db.optionItem.deleteMany({})
    await db.ticketEvent.deleteMany({})
    await db.ticket.deleteMany({})
    await db.user.deleteMany({})
    await db.userRole.deleteMany({})
  })

  async function adminAgent() {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'sa-1', email: 'admin@test.local' })
    return agent
  }

  it('rejects a non-admin (403) and an unknown kind (400)', async () => {
    const nobody = request.agent(app.getHttpServer())
    await nobody.post('/auth/dev-login').send({ sub: 'u', email: 'plain@test.local' })
    expect((await nobody.get('/admin/options/paymentTerm')).status).toBe(403)

    const admin = await adminAgent()
    expect((await admin.get('/admin/options/nope')).status).toBe(400)
  })

  it('creates, lists with usage count, rejects duplicates, renames, and toggles active', async () => {
    const admin = await adminAgent()

    const created = await admin.post('/admin/options/paymentTerm').send({ value: 'Net 30' })
    expect(created.status).toBe(201)
    const id = created.body.id

    // a ticket referencing the value → usedBy = 1
    await db.ticket.create({
      data: { status: 'Submitted', flow: 'Contract', applicantSub: 'a', paymentTerm: 'Net 30' },
    })

    const list = await admin.get('/admin/options/paymentTerm')
    expect(list.status).toBe(200)
    expect(list.body).toHaveLength(1)
    expect(list.body[0]).toMatchObject({ value: 'Net 30', active: true, usedBy: 1 })

    // duplicate value → 409
    expect((await admin.post('/admin/options/paymentTerm').send({ value: 'Net 30' })).status).toBe(409)
    // blank value → 400 (DTO)
    expect((await admin.post('/admin/options/paymentTerm').send({ value: '' })).status).toBe(400)

    // rename
    const renamed = await admin.patch(`/admin/options/${id}`).send({ value: 'Net 45' })
    expect(renamed.status).toBe(200)
    expect(renamed.body.value).toBe('Net 45')

    // deactivate (hide from new forms, never delete)
    const off = await admin.patch(`/admin/options/${id}`).send({ active: false })
    expect(off.body.active).toBe(false)
  })

  it('public /options/:kind returns ACTIVE values only, for any authenticated user', async () => {
    const admin = await adminAgent()
    const a = await admin.post('/admin/options/projectTeam').send({ value: 'Hạ tầng' })
    await admin.post('/admin/options/projectTeam').send({ value: 'Cấp nước' })
    await admin.patch(`/admin/options/${a.body.id}`).send({ active: false }) // hide "Hạ tầng"

    const applicant = request.agent(app.getHttpServer())
    await applicant.post('/auth/dev-login').send({ sub: 'ap-1', email: 'ap@test.local', roles: ['Applicant'] })
    const res = await applicant.get('/options/projectTeam')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(['Cấp nước']) // active only, sorted
  })
})
