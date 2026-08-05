import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { FLOW, ROLE, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'
import { DigestScheduler } from '../src/infra/scheduler/digest.scheduler'
import { DigestDispatcher } from '../src/infra/scheduler/digest.dispatcher'
import { MailPort, type Mail } from '../src/domain/ports/mail.port'
import { SystemClock } from '../src/infra/clock/system-clock'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'
const LAN = 'dcc1-lan'
const DAY = 86_400_000

// Monday 2026-07-27, 08:00 Vietnam. Pinned because the digest only fires on
// working days — running the suite on a weekend must not change the outcome.
const MONDAY = new Date(Date.UTC(2026, 6, 27, 1, 0, 0))

class FixedClock extends SystemClock {
  now(): Date {
    return MONDAY
  }
}

class CapturingMail extends MailPort {
  readonly sent: Mail[] = []
  send(mail: Mail): Promise<void> {
    this.sent.push(mail)
    return Promise.resolve()
  }
}

/** F11 — the morning digest: silent unless something needs the person that day. */
describe('morning digest (e2e — F11)', () => {
  let app: INestApplication
  let admin: PrismaClient
  let mail: CapturingMail
  let scheduler: DigestScheduler
  let dispatcher: DigestDispatcher

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    mail = new CapturingMail()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailPort)
      .useValue(mail)
      .overrideProvider(SystemClock)
      .useValue(new FixedClock())
      .compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
    scheduler = app.get(DigestScheduler)
    dispatcher = app.get(DigestDispatcher)
  })

  afterAll(async () => {
    await admin.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    mail.sent.length = 0
    await admin.$executeRaw`DELETE FROM digest_outbox`
    await admin.ticketSlaPause.deleteMany({})
    await admin.ticketLock.deleteMany({})
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
    await admin.userRole.deleteMany({ where: { sub: LAN } })
    await admin.user.deleteMany({ where: { sub: LAN } })
    await admin.user.create({ data: { sub: LAN, email: 'lan@pmh.com.vn', fullName: 'Chị Lan' } })
    await admin.userRole.create({ data: { sub: LAN, role: ROLE.Dcc1 } })
  })

  /** A ticket Lan holds, sitting long past its SLA. */
  function overdueTicket(over: Record<string, unknown> = {}) {
    return admin.ticket.create({
      data: {
        status: TICKET_STATUS.SubmittedToVpAndy,
        flow: FLOW.General,
        applicantSub: 'a',
        priority: 'normal',
        code: 'PMH-A-2026-0001',
        currentHolderSub: LAN,
        statusEnteredAt: new Date(MONDAY.getTime() - 30 * DAY),
        ...over,
      },
    })
  }

  async function runDigest(): Promise<void> {
    await scheduler.scan()
    await dispatcher.dispatch()
  }

  it('mails nothing when the person holds nothing — silence is the default', async () => {
    await runDigest()
    expect(mail.sent).toHaveLength(0)
    expect(await admin.$queryRaw`SELECT * FROM digest_outbox`).toEqual([])
  })

  it('mails a DCC holding an overdue ticket, naming the ticket', async () => {
    await overdueTicket()
    await runDigest()
    expect(mail.sent).toHaveLength(1)
    expect(mail.sent[0]?.to).toBe('lan@pmh.com.vn')
    expect(mail.sent[0]?.subject).toContain('TRỄ')
    expect(mail.sent[0]?.body).toContain('PMH-A-2026-0001')
    expect(mail.sent[0]?.body).toContain('Chị Lan')
  })

  it('sends at most ONE digest per person per day, however often it runs', async () => {
    await overdueTicket()
    await runDigest()
    await runDigest()
    await runDigest()
    expect(mail.sent).toHaveLength(1)
  })

  it('stays silent about a ticket whose clock is paused (F8) — that wait was explained', async () => {
    const t = await overdueTicket()
    await admin.ticketSlaPause.create({
      data: {
        ticketId: t.id,
        reason: 'Chờ nhà thầu',
        pausedBySub: LAN,
        status: TICKET_STATUS.SubmittedToVpAndy,
        pausedAt: new Date(MONDAY.getTime() - 30 * DAY),
      },
    })
    await runDigest()
    expect(mail.sent).toHaveLength(0)
  })

  it('respects the opt-out switch', async () => {
    await overdueTicket()
    await admin.user.update({ where: { sub: LAN }, data: { digestOptOut: true } })
    await runDigest()
    expect(mail.sent).toHaveLength(0)
  })

  it('drops a queued digest if the person clears their queue before delivery', async () => {
    const t = await overdueTicket()
    await scheduler.scan()
    // Handed on before the mail went out: nothing left to say.
    await admin.ticket.update({ where: { id: t.id }, data: { currentHolderSub: null } })
    await dispatcher.dispatch()
    expect(mail.sent).toHaveLength(0)
  })

  it('reports a Pool ticket to DCC1 once it is running out of time', async () => {
    await admin.ticket.create({
      data: {
        status: TICKET_STATUS.Submitted,
        flow: FLOW.General,
        applicantSub: 'a',
        priority: 'normal',
        code: 'PMH-A-2026-0777',
        statusEnteredAt: new Date(MONDAY.getTime() - 30 * DAY),
      },
    })
    await runDigest()
    expect(mail.sent[0]?.body).toContain('PMH-A-2026-0777')
    expect(mail.sent[0]?.subject).toContain('chờ xác nhận')
  })

  it('stays silent about a Pool ticket submitted moments ago — the Pool is never empty', async () => {
    await admin.ticket.create({
      data: {
        status: TICKET_STATUS.Submitted,
        flow: FLOW.General,
        applicantSub: 'a',
        priority: 'normal',
        code: 'PMH-A-2026-0778',
        statusEnteredAt: MONDAY,
      },
    })
    await runDigest()
    expect(mail.sent).toHaveLength(0)
  })

  it('never mails an Applicant — they already get per-event mail', async () => {
    await admin.userRole.deleteMany({ where: { sub: LAN } })
    await admin.userRole.create({ data: { sub: LAN, role: ROLE.Applicant } })
    await overdueTicket()
    await runDigest()
    expect(mail.sent).toHaveLength(0)
  })

  it('lets a user turn their own digest off and back on', async () => {
    const agent: Agent = request.agent(app.getHttpServer())
    // Send the email like a real login does: upsertUser mirrors the IdP claims,
    // so a login without one deliberately clears the stored address.
    await agent.post('/auth/dev-login').send({ sub: LAN, email: 'lan@pmh.com.vn', roles: [ROLE.Dcc1] })
    expect((await agent.get('/me/digest')).body).toEqual({ enabled: true })

    await agent.post('/me/digest').send({ enabled: false }).expect(201)
    expect((await agent.get('/me/digest')).body).toEqual({ enabled: false })

    await overdueTicket()
    await runDigest()
    expect(mail.sent).toHaveLength(0)

    await agent.post('/me/digest').send({ enabled: true })
    await admin.$executeRaw`DELETE FROM digest_outbox`
    await runDigest()
    expect(mail.sent).toHaveLength(1)
  })
})
