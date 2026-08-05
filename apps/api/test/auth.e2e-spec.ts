process.env.DATABASE_URL ||= 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from '../src/app.module'

describe('auth (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('rejects /auth/me without a session (401)', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me')
    expect(res.status).toBe(401)
  })

  it('dev-login sets an httpOnly cookie; /auth/me returns roles + activeRole (H3)', async () => {
    const agent = request.agent(app.getHttpServer())
    const login = await agent
      .post('/auth/dev-login')
      .send({ sub: 'u-1', roles: ['Applicant', 'DCC1'] })
    expect(login.status).toBe(201)
    expect(String(login.headers['set-cookie']?.[0] ?? '')).toMatch(/HttpOnly/i)

    const me = await agent.get('/auth/me')
    expect(me.status).toBe(200)
    expect(me.body.sub).toBe('u-1')
    expect(me.body.roles).toEqual(['Applicant', 'DCC1'])
    expect(me.body.activeRole).toBe('Applicant')
  })

  it('active-role switch is constrained to roles the user holds', async () => {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'u-2', roles: ['Applicant', 'DCC1'] })

    const ok = await agent.post('/auth/active-role').send({ role: 'DCC1' })
    expect(ok.status).toBe(201)
    expect(ok.body.activeRole).toBe('DCC1')

    const bad = await agent.post('/auth/active-role').send({ role: 'DCC3' })
    expect(bad.status).toBe(400)
  })
})
