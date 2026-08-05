import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { createHmac } from 'node:crypto'
import { AppModule } from '../src/app.module'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const SECRET = 'test-webhook-secret' // must match vitest.config PMH_WEBHOOK_SECRET

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(Buffer.from(body)).digest('hex')
}

describe('PMH ID offboarding webhook (e2e — HMAC + instant session revoke)', () => {
  let app: INestApplication
  let admin: PrismaClient

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication({ rawBody: true })
    app.use(cookieParser())
    await app.init()
  })

  afterAll(async () => {
    await admin.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await admin.processedWebhookEvent.deleteMany({})
  })

  async function loginAs(sub: string): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles: ['Applicant'] }).expect(201)
    await agent.get('/auth/me').expect(200)
    return agent
  }

  function postWebhook(body: string, sig?: string) {
    const req = request(app.getHttpServer()).post('/webhooks/pmh-id').set('content-type', 'application/json')
    if (sig !== undefined) req.set('x-pmh-signature', sig)
    return req.send(body)
  }

  it('kills every session for a user on user.locked and flips the directory status', async () => {
    const sub = 'wh-user-1'
    const agent = await loginAs(sub)
    const body = JSON.stringify({ type: 'user.locked', user_id: sub, event_id: 'evt-lock-1' })

    await postWebhook(body, sign(body)).expect(200)

    await agent.get('/auth/me').expect(401) // session revoked immediately
    const u = await admin.user.findUnique({ where: { sub }, select: { status: true } })
    expect(u?.status).toBe('locked')
  })

  it('rejects a bad or missing signature (401) and leaves sessions untouched', async () => {
    const sub = 'wh-user-2'
    const agent = await loginAs(sub)
    const body = JSON.stringify({ type: 'user.locked', user_id: sub, event_id: 'evt-x' })

    await postWebhook(body, 'deadbeef').expect(401)
    await postWebhook(body).expect(401) // missing signature header
    await agent.get('/auth/me').expect(200) // still logged in
  })

  it('answers 400 (not 500) on a correctly-signed but malformed payload', async () => {
    const raw = '{ not json'
    await postWebhook(raw, sign(raw)).expect(400)
  })

  it('is idempotent on replay of the same event_id', async () => {
    const sub = 'wh-user-3'
    await loginAs(sub)
    const body = JSON.stringify({ type: 'user.locked', user_id: sub, event_id: 'evt-dup' })

    await postWebhook(body, sign(body)).expect(200)
    await postWebhook(body, sign(body)).expect(200) // replay must not error
    expect(await admin.processedWebhookEvent.count({ where: { eventId: 'evt-dup' } })).toBe(1)
  })
})
