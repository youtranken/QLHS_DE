import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** Story 5.1 — admin edits SLA thresholds (AD-6). Table + seed already exist from
 *  Story 1.3; this covers the admin-edit endpoints + guard + validation. */
describe('Admin SLA config (e2e)', () => {
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
    // Restore the seeded value so other suites read the canonical threshold.
    await admin.slaConfig.update({
      where: { status_flow: { status: 'Submitted to BOP', flow: 'Contract' } },
      data: { slaDays: 7, updatedBySub: null },
    })
    await admin.slaConfig.deleteMany({ where: { status: 'Received by DCC3', flow: 'Payment' } })
    await admin.$disconnect()
    await app.close()
  })

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  it('admin lists the seeded (status, flow) thresholds', async () => {
    const sa = await login('sa-e2e', ['Admin'])
    const res = await sa.get('/admin/sla-config')
    expect(res.status).toBe(200)
    const bop = res.body.find((r: { status: string; flow: string }) => r.status === 'Submitted to BOP' && r.flow === 'Contract')
    expect(bop?.slaDays).toBe(7)
  })

  it('admin updates a threshold → the next read returns the new value (AC1)', async () => {
    const sa = await login('sa-e2e', ['Admin'])
    const put = await sa.put(`/admin/sla-config/Contract/${encodeURIComponent('Submitted to BOP')}`).send({ slaDays: 9 })
    expect(put.status).toBe(200)
    const row = await admin.slaConfig.findUniqueOrThrow({
      where: { status_flow: { status: 'Submitted to BOP', flow: 'Contract' } },
    })
    expect(row.slaDays).toBe(9)
    expect(row.updatedBySub).toBe('sa-e2e')
  })

  it('admin can upsert a (status, flow) row that has no explicit config yet', async () => {
    const sa = await login('sa-e2e', ['Admin'])
    const put = await sa.put(`/admin/sla-config/Payment/${encodeURIComponent('Received by DCC3')}`).send({ slaDays: 3 })
    expect(put.status).toBe(200)
    const row = await admin.slaConfig.findUniqueOrThrow({
      where: { status_flow: { status: 'Received by DCC3', flow: 'Payment' } },
    })
    expect(row.slaDays).toBe(3)
  })

  it('rejects a non-positive threshold (400) and leaves the old value', async () => {
    const sa = await login('sa-e2e', ['Admin'])
    const res = await sa.put(`/admin/sla-config/Contract/${encodeURIComponent('Submitted to BOP')}`).send({ slaDays: 0 })
    expect(res.status).toBe(400)
    const row = await admin.slaConfig.findUniqueOrThrow({
      where: { status_flow: { status: 'Submitted to BOP', flow: 'Contract' } },
    })
    expect(row.slaDays).toBe(9) // unchanged from the previous successful update
  })

  it('rejects a non-canonical (status, flow) key (400) — no dead config row (code-review)', async () => {
    const sa = await login('sa-e2e', ['Admin'])
    const badFlow = await sa.put(`/admin/sla-config/Nope/${encodeURIComponent('Submitted to BOP')}`).send({ slaDays: 5 })
    expect(badFlow.status).toBe(400)
    const badStatus = await sa.put(`/admin/sla-config/Contract/${encodeURIComponent('Bogus Status')}`).send({ slaDays: 5 })
    expect(badStatus.status).toBe(400)
    expect(await admin.slaConfig.count({ where: { flow: 'Nope' } })).toBe(0)
  })

  it('a non-admin cannot read or edit the SLA config (403)', async () => {
    const dcc1 = await login('dcc1-e2e', ['DCC1'])
    expect((await dcc1.get('/admin/sla-config')).status).toBe(403)
    expect((await dcc1.put(`/admin/sla-config/Contract/${encodeURIComponent('Submitted to BOP')}`).send({ slaDays: 5 })).status).toBe(403)
  })
})
