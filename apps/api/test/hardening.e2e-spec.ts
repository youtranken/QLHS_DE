import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test } from '@nestjs/testing'
import { type NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { applyHardening } from '../src/http/common/hardening'

/** 1.2 — the security headers applyHardening() must put on every response. */
describe('edge hardening (e2e — 1.2)', () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication<NestExpressApplication>()
    applyHardening(app)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('sets helmet defaults and hides the framework banner', async () => {
    const res = await request(app.getHttpServer()).get('/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(res.headers['content-security-policy']).toBeDefined()
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})
