import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

/**
 * 1.2 — the login rate limiter. The whole suite disables the throttler so bursts
 * of supertest calls from one loopback IP can't make other files flaky; this
 * file turns it back on for itself and proves the brute-force gate actually bites.
 */
describe('POST /auth/local-login rate limit (e2e — 1.2)', () => {
  let app: INestApplication
  const prev = process.env.QLHS_DISABLE_THROTTLE

  beforeAll(async () => {
    process.env.QLHS_DISABLE_THROTTLE = '0' // skipIf reads this live, per request
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
  })

  afterAll(async () => {
    process.env.QLHS_DISABLE_THROTTLE = prev
    await app.close()
  })

  it('allows a few wrong-password attempts, then locks the IP with 429', async () => {
    const agent = request.agent(app.getHttpServer())
    const attempt = () =>
      agent.post('/auth/local-login').send({ username: 'ghost', password: 'wrong' })

    // Four wrong attempts get the honest "wrong credentials" 401…
    for (let i = 0; i < 4; i++) {
      expect((await attempt()).status).toBe(401)
    }
    // …the fifth trips the per-IP brute-force lockout (429, code TooManyAttempts)…
    const fifth = await attempt()
    expect(fifth.status).toBe(429)
    expect(fifth.body.code).toBe('TooManyAttempts')
    // …and it stays locked — further attempts are refused without checking creds.
    expect((await attempt()).status).toBe(429)
  })
})
