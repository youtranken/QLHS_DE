import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { FLOW, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** 3.2 — Prometheus scrape endpoint + token guard. */
describe('metrics (e2e — 3.2)', () => {
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
    delete process.env.QLHS_METRICS_TOKEN
    await db.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    delete process.env.QLHS_METRICS_TOKEN
    await db.notificationOutbox.deleteMany({})
    await db.ticketSlaPause.deleteMany({})
    await db.ticketEvent.deleteMany({})
    await db.ticket.deleteMany({})
  })

  it('serves the exposition format with the process + ticket gauges', async () => {
    await db.ticket.create({
      data: {
        status: TICKET_STATUS.Submitted,
        flow: FLOW.General,
        applicantSub: 'a',
        priority: 'normal',
        code: 'M-1',
      },
    })

    const res = await request(app.getHttpServer()).get('/metrics').expect(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.text).toContain('# TYPE qlhs_up gauge')
    expect(res.text).toContain('qlhs_up 1')
    expect(res.text).toContain('qlhs_process_uptime_seconds')
    expect(res.text).toMatch(/qlhs_tickets\{flow="General",status="Submitted"\} 1/)
    expect(res.text).toContain('qlhs_mail_outbox{status="pending"}')
    expect(res.text).toContain('qlhs_digest_outbox{status="failed"}')
    expect(res.text).toContain('qlhs_sla_pauses_open')
  })

  it('is open when no token is configured', async () => {
    await request(app.getHttpServer()).get('/metrics').expect(200)
  })

  it('requires a bearer token once QLHS_METRICS_TOKEN is set', async () => {
    process.env.QLHS_METRICS_TOKEN = 's3cret'
    await request(app.getHttpServer()).get('/metrics').expect(401)
    await request(app.getHttpServer())
      .get('/metrics')
      .set('Authorization', 'Bearer wrong')
      .expect(401)
    await request(app.getHttpServer())
      .get('/metrics')
      .set('Authorization', 'Bearer s3cret')
      .expect(200)
  })

  it('treats a blank/whitespace token as unset (open), never a lock-out', async () => {
    process.env.QLHS_METRICS_TOKEN = '   '
    await request(app.getHttpServer()).get('/metrics').expect(200)
  })
})
