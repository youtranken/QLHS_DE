import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'
import {
  LocalAdminBootstrap,
  LOCAL_ADMIN_SUB,
  LOCAL_ADMIN_EMAIL,
} from '../src/infra/auth/local-admin.bootstrap'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const SA_USERNAME = 'admin.ssa' // matches vitest QLHS_LOCAL_ADMIN_USERNAME
const SA_PASSWORD = 'Test-Local-SA-1' // matches vitest QLHS_LOCAL_ADMIN_PASSWORD

describe('local (non-SSO) SA — bootstrap + login', () => {
  let app: INestApplication
  let admin: PrismaClient
  let bootstrap: LocalAdminBootstrap

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
    // Other e2e files wipe user/user_role between tests; re-seed so this file is
    // order-independent (also re-asserts the bootstrap is idempotent).
    bootstrap = app.get(LocalAdminBootstrap)
    await bootstrap.onModuleInit()
  })

  afterAll(async () => {
    await admin.$disconnect()
    await app.close()
  })

  it('seeds a User + Admin role + username credentials from env', async () => {
    const user = await admin.user.findUnique({ where: { sub: LOCAL_ADMIN_SUB } })
    expect(user?.email).toBe(LOCAL_ADMIN_EMAIL) // display identity only
    const roles = await admin.userRole.findMany({ where: { sub: LOCAL_ADMIN_SUB } })
    expect(roles.map((r) => r.role)).toContain('Admin')
    const cred = await admin.localCredential.findUnique({ where: { sub: LOCAL_ADMIN_SUB } })
    expect(cred?.username).toBe(SA_USERNAME)
    expect(cred?.passwordHash).not.toContain(SA_PASSWORD) // stored hashed, never plaintext
  })

  it('logs in with username + password and gets an Admin session', async () => {
    const agent = request.agent(app.getHttpServer())
    const res = await agent.post('/auth/local-login').send({ username: SA_USERNAME, password: SA_PASSWORD })
    expect(res.status).toBe(201)
    const me = await agent.get('/auth/me')
    expect(me.body.roles).toContain('Admin')
    expect(me.body.activeRole).toBe('Admin')
  })

  it('rejects a wrong password with 401 (no user oracle)', async () => {
    const agent = request.agent(app.getHttpServer())
    const res = await agent.post('/auth/local-login').send({ username: SA_USERNAME, password: 'nope' })
    expect(res.status).toBe(401)
  })

  it('rejects an unknown username with 401', async () => {
    const agent = request.agent(app.getHttpServer())
    const res = await agent.post('/auth/local-login').send({ username: 'ghost', password: SA_PASSWORD })
    expect(res.status).toBe(401)
  })

  it('rejects an email as the username — emails go to SSO, never local-login', async () => {
    const agent = request.agent(app.getHttpServer())
    const res = await agent.post('/auth/local-login').send({ username: 'admin.ssa@local.com', password: SA_PASSWORD })
    expect(res.status).toBe(401)
  })
})
