import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

describe('admin — local RBAC (e2e)', () => {
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
    await admin.userRole.deleteMany({})
    await admin.user.deleteMany({})
  })

  /** dev-login with an admin email → auto-granted Admin (bootstrap). */
  async function adminAgent() {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'sa-1', email: 'admin@test.local' })
    return agent
  }

  it('bootstraps Admin by configured email', async () => {
    const agent = await adminAgent()
    const me = await agent.get('/auth/me')
    expect(me.body.roles).toEqual(['Admin'])
    expect(me.body.activeRole).toBe('Admin')
  })

  it('Admin assigns a role that applies on the user’s next login (before-login)', async () => {
    const agent = await adminAgent()
    const res = await agent.put('/admin/users/target-1/roles').send({ roles: ['DCC1'] })
    expect(res.status).toBe(200)

    // target-1 has never logged in; log them in with NO roles in the payload —
    // the role must come from the admin's assignment.
    const target = request.agent(app.getHttpServer())
    await target.post('/auth/dev-login').send({ sub: 'target-1' })
    const me = await target.get('/auth/me')
    expect(me.body.roles).toEqual(['DCC1'])
  })

  it('propagates a role change to the user’s LIVE session (no re-login needed)', async () => {
    const target = request.agent(app.getHttpServer())
    await target.post('/auth/dev-login').send({ sub: 'live-1', roles: ['Applicant'] })
    expect((await target.get('/auth/me')).body.roles).toEqual(['Applicant'])

    // Admin re-assigns while target's session/cookie is unchanged.
    const sa = await adminAgent()
    await sa.put('/admin/users/live-1/roles').send({ roles: ['DCC1'] })

    const me = await target.get('/auth/me')
    expect(me.body.roles).toEqual(['DCC1'])
    expect(me.body.activeRole).toBe('DCC1')
  })

  it('rejects an invalid role (400)', async () => {
    const agent = await adminAgent()
    const res = await agent.put('/admin/users/target-2/roles').send({ roles: ['Wizard'] })
    expect(res.status).toBe(400)
  })

  it('refuses to let an Admin strip their OWN Admin role (409 self-lockout)', async () => {
    const agent = await adminAgent() // sub sa-1, bootstrapped Admin
    const res = await agent.put('/admin/users/sa-1/roles').send({ roles: ['DCC1'] })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('SelfLockout')
    // still Admin — the change was rejected atomically
    expect((await agent.get('/auth/me')).body.roles).toContain('Admin')
  })

  it('lets an Admin keep Admin while adding another role to themselves', async () => {
    const agent = await adminAgent()
    const res = await agent.put('/admin/users/sa-1/roles').send({ roles: ['Admin', 'DCC1'] })
    expect(res.status).toBe(200)
  })

  it('forbids a non-admin from the admin console (403)', async () => {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'plain-1', roles: ['Applicant'] })
    expect((await agent.get('/admin/users')).status).toBe(403)
    expect((await agent.put('/admin/users/x/roles').send({ roles: ['DCC1'] })).status).toBe(403)
  })
})
