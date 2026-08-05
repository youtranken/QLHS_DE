import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'
import { MailPort, type Mail } from '../src/domain/ports/mail.port'
import { OutboxDispatcher } from '../src/infra/scheduler/outbox.dispatcher'
import { ReturnReminderScheduler } from '../src/infra/scheduler/return-reminder.scheduler'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const FIELDS = {
  documentType: 'General', description: 'x', paymentTerm: 'N/A', contractNo: 'N/A',
  projectTeam: 'A', currency: 'VND', amount: '1000', budgetCode: 'B', contractor: 'ACME',
}

/** A recording MailPort — no real SMTP; can be told to fail the next N sends. */
class FakeMail extends MailPort {
  sent: Mail[] = []
  failNext = 0
  async send(mail: Mail): Promise<void> {
    if (this.failNext > 0) {
      this.failNext--
      throw new Error('smtp down')
    }
    this.sent.push(mail)
  }
}

/** Story 5.2 — outbox dispatcher (AD-15/M4): matrix-driven intents, at-least-once
 *  + idempotent delivery, SMTP-failure retry, and the Return-fixing reminder. */
describe('Email outbox dispatcher (e2e)', () => {
  let app: INestApplication
  let admin: PrismaClient
  let mail: FakeMail

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    mail = new FakeMail()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailPort)
      .useValue(mail)
      .compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
    // Silence the real crons so manual dispatch()/scan() calls are deterministic.
    const reg = app.get(SchedulerRegistry)
    reg.getIntervals().forEach((n) => reg.deleteInterval(n))
    reg.getCronJobs().forEach((_job, n) => reg.deleteCronJob(n))
  })

  afterAll(async () => {
    await admin.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    mail.sent = []
    mail.failNext = 0
    await admin.notificationOutbox.deleteMany({})
    await admin.ticketLock.deleteMany({})
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
    await admin.numberCounter.deleteMany({})
    await admin.user.deleteMany({ where: { sub: { startsWith: 'app-outbox' } } })
  })

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  /** An Applicant with a resolvable email (dispatcher joins user by sub). dev-login
   *  upserts the user row (email null in dev), so set the email AFTER logging in. */
  async function applicantWithEmail(sub: string): Promise<Agent> {
    const agent = await login(sub, ['Applicant'])
    await admin.user.upsert({
      where: { sub },
      update: { email: `${sub}@pmh.com.vn` },
      create: { sub, email: `${sub}@pmh.com.vn` },
    })
    return agent
  }

  function dispatcher(): OutboxDispatcher {
    return app.get(OutboxDispatcher)
  }

  it('General Completed writes a Completed intent; the dispatcher sends it once (AC1/AC4)', async () => {
    const applicant = await applicantWithEmail('app-outbox-1')
    const dcc = await login('dcc1-outbox', ['DCC1'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'andyApproveComplete' })

    const intent = await admin.notificationOutbox.findFirstOrThrow({ where: { ticketId: id } })
    expect(intent.kind).toBe('Completed')
    expect(intent.status).toBe('pending')

    expect(await dispatcher().dispatch()).toBe(1)
    expect(mail.sent).toHaveLength(1)
    expect(mail.sent[0]?.to).toBe('app-outbox-1@pmh.com.vn')
    // Idempotent: a second run sends nothing (already 'sent').
    expect(await dispatcher().dispatch()).toBe(0)
    expect(mail.sent).toHaveLength(1)
    const after = await admin.notificationOutbox.findFirstOrThrow({ where: { ticketId: id } })
    expect(after.status).toBe('sent')
  })

  it('Returned writes a Returned intent (AC1)', async () => {
    const applicant = await applicantWithEmail('app-outbox-2')
    const dcc = await login('dcc1-outbox', ['DCC1'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'sendBack', reason: 'Sai loại' })

    const intent = await admin.notificationOutbox.findFirstOrThrow({ where: { ticketId: id } })
    expect(intent.kind).toBe('Returned')
  })

  it('a failed transition leaves NO outbox intent (AC3 — no ghost email)', async () => {
    const applicant = await applicantWithEmail('app-outbox-3')
    const dcc = await login('dcc1-outbox', ['DCC1'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    // completeContract is illegal here → the whole transaction rolls back.
    const res = await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'bopApprove' })
    expect(res.status).toBe(409)
    expect(await admin.notificationOutbox.count({ where: { ticketId: id } })).toBe(0)
  })

  it('a transient SMTP failure keeps the intent retryable; the next run sends it (AC5)', async () => {
    const applicant = await applicantWithEmail('app-outbox-4')
    const dcc = await login('dcc1-outbox', ['DCC1'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'andyApproveComplete' })

    mail.failNext = 1
    expect(await dispatcher().dispatch()).toBe(0) // send threw → not sent
    const failed = await admin.notificationOutbox.findFirstOrThrow({ where: { ticketId: id } })
    expect(failed.status).toBe('pending') // still retryable
    expect(failed.attempts).toBe(1)

    await admin.notificationOutbox.updateMany({ data: { nextAttemptAt: null } }) // backoff elapsed
    expect(await dispatcher().dispatch()).toBe(1) // retried → sent
    expect(mail.sent).toHaveLength(1)
  })

  it('backs off after a failure — not retried until next_attempt_at is due', async () => {
    const applicant = await applicantWithEmail('app-outbox-bo')
    const dcc = await login('dcc1-outbox', ['DCC1'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'andyApproveComplete' })

    mail.failNext = 1
    expect(await dispatcher().dispatch()).toBe(0)
    const row1 = await admin.notificationOutbox.findFirstOrThrow({ where: { ticketId: id } })
    expect(row1.status).toBe('pending')
    expect(row1.attempts).toBe(1)
    expect(row1.nextAttemptAt).not.toBeNull() // parked into the future
    expect(row1.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now())

    // Immediate re-run must NOT retry it yet (backoff) — mail untouched, attempts flat.
    expect(await dispatcher().dispatch()).toBe(0)
    const row2 = await admin.notificationOutbox.findFirstOrThrow({ where: { ticketId: id } })
    expect(row2.attempts).toBe(1)
    expect(mail.sent).toHaveLength(0)

    // Once the backoff window elapses it is delivered.
    await admin.notificationOutbox.updateMany({ data: { nextAttemptAt: new Date(Date.now() - 1000) } })
    expect(await dispatcher().dispatch()).toBe(1)
  })

  it('survives an outage longer than the old 5-retry window without losing the mail', async () => {
    const applicant = await applicantWithEmail('app-outbox-long')
    const dcc = await login('dcc1-outbox', ['DCC1'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'andyApproveComplete' })

    for (let i = 0; i < 6; i++) {
      mail.failNext = 1
      await admin.notificationOutbox.updateMany({ data: { nextAttemptAt: null } }) // make due
      await dispatcher().dispatch()
    }
    const stillPending = await admin.notificationOutbox.findFirstOrThrow({ where: { ticketId: id } })
    expect(stillPending.status).toBe('pending') // NOT permanently 'failed' after 6 fails
    expect(stillPending.attempts).toBe(6)

    // SMTP recovers → delivered.
    await admin.notificationOutbox.updateMany({ data: { nextAttemptAt: null } })
    expect(await dispatcher().dispatch()).toBe(1)
    expect(mail.sent).toHaveLength(1)
  })

  it('a missing recipient email is retryable, not a permanent failure (code-review #2)', async () => {
    const applicant = await login('app-outbox-noemail', ['Applicant']) // dev-login → email null
    const dcc = await login('dcc1-outbox', ['DCC1'])
    const id = (await applicant.post('/tickets').send(FIELDS)).body.id as string
    await dcc.post(`/dcc1/pool/${id}/pick`)
    await dcc.post(`/dcc1/pool/${id}/confirm`)
    await dcc.post(`/dcc1/tickets/${id}/action`).send({ event: 'andyApproveComplete' })
    await admin.user.update({ where: { sub: 'app-outbox-noemail' }, data: { email: null } })

    expect(await dispatcher().dispatch()).toBe(0)
    const pending = await admin.notificationOutbox.findFirstOrThrow({ where: { ticketId: id } })
    expect(pending.status).toBe('pending') // retryable, NOT terminal 'failed'
    expect(pending.attempts).toBe(1)

    // Once the directory cache fills the email, the next run delivers it.
    await admin.user.update({ where: { sub: 'app-outbox-noemail' }, data: { email: 'later@pmh.com.vn' } })
    await admin.notificationOutbox.updateMany({ data: { nextAttemptAt: null } }) // backoff elapsed
    expect(await dispatcher().dispatch()).toBe(1)
    expect(mail.sent).toHaveLength(1)
  })

  it('a stale prior-round reminder is skipped, not sent (code-review #3)', async () => {
    const sub = 'app-outbox-stale'
    await admin.user.upsert({ where: { sub }, update: { email: `${sub}@pmh.com.vn` }, create: { sub, email: `${sub}@pmh.com.vn` } })
    // Ticket is back at Return-fixing for round 2, but a round-1 reminder is still pending.
    const t = await admin.ticket.create({
      data: { status: 'Return-fixing', flow: 'General', applicantSub: sub, priority: 'normal', code: 'G-2026-0701', roundNo: 2, statusEnteredAt: new Date(Date.now() - 8 * 24 * 3600_000) },
    })
    await admin.notificationOutbox.create({
      data: { ticketId: t.id, roundNo: 1, kind: 'return_reminder', recipientSub: sub, status: 'pending' },
    })
    expect(await dispatcher().dispatch()).toBe(0) // round 1 ≠ ticket round 2 → skipped
    expect(mail.sent).toHaveLength(0)
    const row = await admin.notificationOutbox.findFirstOrThrow({ where: { ticketId: t.id } })
    expect(row.status).toBe('sent')
    expect(row.lastError).toContain('stale')
  })

  it('Payment Sent to Accounting writes NO email intent (H5 regression)', async () => {
    const dcc3 = await login('dcc3-outbox', ['DCC3'])
    const t = await admin.ticket.create({
      data: { status: 'Received by DCC3', flow: 'Payment', applicantSub: 'app-outbox-5', priority: 'normal', code: 'CT-2026-0501', roundNo: 0 },
    })
    await dcc3.post(`/dcc3/tickets/${t.id}/send-accounting`).send({ documentNo: '26-CC-501-CT' })
    expect(await admin.notificationOutbox.count({ where: { ticketId: t.id } })).toBe(0)
  })

  it('Return-fixing reminder: enqueued once/round, re-validated at send (AC2)', async () => {
    const sub = 'app-outbox-6'
    await admin.user.upsert({ where: { sub }, update: { email: `${sub}@pmh.com.vn` }, create: { sub, email: `${sub}@pmh.com.vn` } })
    const t = await admin.ticket.create({
      data: {
        status: 'Return-fixing', flow: 'General', applicantSub: sub, priority: 'normal',
        code: 'G-2026-0601', roundNo: 1,
        statusEnteredAt: new Date(Date.now() - 8 * 24 * 3600_000), // 8 days → past the 3-day threshold
      },
    })
    const reminder = app.get(ReturnReminderScheduler)
    expect(await reminder.scan()).toBe(1) // one reminder enqueued
    expect(await reminder.scan()).toBe(0) // idempotent per (ticket, round)
    const intent = await admin.notificationOutbox.findFirstOrThrow({ where: { ticketId: t.id } })
    expect(intent.kind).toBe('return_reminder')

    // Applicant resubmits before the send → re-validation skips it (no email).
    await admin.ticket.update({ where: { id: t.id }, data: { status: 'Submitted' } })
    expect(await dispatcher().dispatch()).toBe(0)
    expect(mail.sent).toHaveLength(0)
    const skipped = await admin.notificationOutbox.findFirstOrThrow({ where: { ticketId: t.id } })
    expect(skipped.status).toBe('sent') // marked done, but never emailed
    expect(skipped.lastError).toContain('skipped')
  })
})
