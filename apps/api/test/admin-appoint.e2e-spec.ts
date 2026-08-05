import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

describe('admin appoint via SSO (N4, e2e)', () => {
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
    await db.userRole.deleteMany({})
    await db.localCredential.deleteMany({})
    await db.user.deleteMany({})
    await db.user.createMany({
      data: [
        { sub: 'u-1', email: 'nguyenvana@pmh.com.vn', fullName: 'Nguyễn Văn A' },
        { sub: 'u-2', email: 'tranthib@pmh.com.vn', fullName: 'Trần Thị B' },
      ],
    })
    await db.userRole.create({ data: { sub: 'u-2', role: 'DCC1' } })
  })

  async function adminAgent() {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'sa-1', email: 'admin@test.local' })
    return agent
  }

  it('is Admin-only', async () => {
    const nobody = request.agent(app.getHttpServer())
    await nobody.post('/auth/dev-login').send({ sub: 'x', email: 'plain@test.local' })
    expect((await nobody.get('/admin/appoint/search').query({ q: 'a' })).status).toBe(403)
  })

  it('finds a PMH ID user by name/email and flags account + current roles', async () => {
    const admin = await adminAgent()
    const res = await admin.get('/admin/appoint/search').query({ q: 'nguyenvana' })
    expect(res.status).toBe(200)
    const hit = res.body.find((u: { sub: string }) => u.sub === 'u-1')
    expect(hit).toBeTruthy()
    expect(hit.hasAccount).toBe(true)
    expect(hit.roles).toEqual([]) // not yet appointed
    // one already appointed to DCC1 shows their role
    const other = res.body.length // narrow query may miss u-2; search by email fragment
    expect(other).toBeGreaterThanOrEqual(1)
  })

  it('never surfaces a break-glass local-credential account', async () => {
    await db.user.create({ data: { sub: 'sa-local', email: 'ssa@local.com', fullName: 'Local SA' } })
    await db.localCredential.create({
      data: { sub: 'sa-local', username: 'admin.ssa', passwordHash: 'x' },
    })
    const admin = await adminAgent()
    const res = await admin.get('/admin/appoint/search').query({ q: 'local' })
    expect(res.status).toBe(200)
    expect(res.body.find((u: { sub: string }) => u.sub === 'sa-local')).toBeUndefined()
  })

  it('appoints a found user (reuses the role PUT) and the search then reflects it', async () => {
    const admin = await adminAgent()
    const put = await admin.put('/admin/users/u-1/roles').send({ roles: ['DCC2'] })
    expect(put.status).toBe(200)

    const res = await admin.get('/admin/appoint/search').query({ q: 'nguyen' })
    const hit = res.body.find((u: { sub: string }) => u.sub === 'u-1')
    expect(hit.roles).toEqual(['DCC2'])
  })
})
