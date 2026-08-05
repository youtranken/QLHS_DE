import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { FLOW, PRIORITY, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'
import { LockRepo } from '../src/infra/prisma/ticket/lock.repo'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

describe('DCC1 pool pickup + soft lock (e2e — AD-9/AD-14)', () => {
  let app: INestApplication
  let admin: PrismaClient
  let lock: LockRepo

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
    lock = app.get(LockRepo)
  })

  afterAll(async () => {
    await admin.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await admin.ticketLock.deleteMany({})
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
  })

  async function seedSubmitted(over: { priority?: string; enteredAt?: Date } = {}): Promise<string> {
    const t = await admin.ticket.create({
      data: {
        status: TICKET_STATUS.Submitted,
        flow: FLOW.General,
        applicantSub: 'app-x',
        priority: over.priority ?? PRIORITY.Normal,
        statusEnteredAt: over.enteredAt ?? new Date(),
      },
    })
    return t.id
  }

  async function dcc1(sub: string) {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles: ['DCC1'] })
    return agent
  }

  it('two concurrent picks → exactly one succeeds', async () => {
    const id = await seedSubmitted()
    const now = new Date()
    const [a, b] = await Promise.all([
      lock.pickFromPool(id, 'dcc1-a', now),
      lock.pickFromPool(id, 'dcc1-b', now),
    ])
    const picks = [a, b].filter((r) => r.picked)
    expect(picks).toHaveLength(1)
    const loser = [a, b].find((r) => !r.picked)
    expect(loser?.heldBy).toMatch(/dcc1-[ab]/)
    // exactly one pool_picked audit row
    const events = await admin.ticketEvent.findMany({ where: { ticketId: id, action: 'pool_picked' } })
    expect(events).toHaveLength(1)
  })

  it('HTTP pick then a second DCC1 pick → 409 with the holder', async () => {
    const id = await seedSubmitted()
    const a = await dcc1('dcc1-a')
    const b = await dcc1('dcc1-b')
    expect((await a.post(`/dcc1/pool/${id}/pick`)).status).toBe(201)
    const second = await b.post(`/dcc1/pool/${id}/pick`)
    expect(second.status).toBe(409)
    expect(second.body.code).toBe('AlreadyPicked')
  })

  it('seize takes over an expired lock but not a live one', async () => {
    const id = await seedSubmitted()
    // expired lock held by dcc1-a
    await admin.ticketLock.create({
      data: {
        ticketId: id,
        holderSub: 'dcc1-a',
        acquiredAt: new Date(Date.now() - 10 * 60_000),
        expiresAt: new Date(Date.now() - 60_000),
      },
    })
    const seized = await lock.seize(id, 'dcc1-b', new Date())
    expect(seized.acquired).toBe(true)
    expect(seized.seized).toBe(true)
    // now dcc1-b holds a live lock → dcc1-c cannot seize
    const blocked = await lock.seize(id, 'dcc1-c', new Date())
    expect(blocked.acquired).toBe(false)
    expect(blocked.holderSub).toBe('dcc1-b')
  })

  it('GET /dcc1/pool lists Submitted tickets; non-DCC1 is forbidden', async () => {
    const id = await seedSubmitted({ priority: PRIORITY.Urgent })
    const a = await dcc1('dcc1-a')
    const pool = await a.get('/dcc1/pool')
    expect(pool.status).toBe(200)
    expect(pool.body.some((c: { id: string }) => c.id === id)).toBe(true)

    const applicant = request.agent(app.getHttpServer())
    await applicant.post('/auth/dev-login').send({ sub: 'app-1', roles: ['Applicant'] })
    expect((await applicant.get('/dcc1/pool')).status).toBe(403)
  })
})
