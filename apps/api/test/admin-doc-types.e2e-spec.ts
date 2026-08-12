import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

interface DocType {
  id: string
  value: string
  active: boolean
  usedBy: number
}
interface DocTypeGroup {
  flow: string
  types: DocType[]
}
const flatten = (groups: DocTypeGroup[]): DocType[] => groups.flatMap((g) => g.types)
const find = (groups: DocTypeGroup[], value: string) => flatten(groups).find((d) => d.value === value)

describe('admin document-types hide/delete (e2e)', () => {
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
    await db.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    await db.optionItem.deleteMany({})
    await db.ticketEvent.deleteMany({})
    await db.ticket.deleteMany({})
    await db.user.deleteMany({})
    await db.userRole.deleteMany({})
  })

  async function adminAgent() {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub: 'sa-1', email: 'admin@test.local' })
    return agent
  }

  // POST /admin/document-types returns {value, flow} (no id) — read the id back from
  // the admin listing, which is the same path the UI uses.
  async function addType(admin: ReturnType<typeof request.agent>, value: string, flow: string): Promise<string> {
    await admin.post('/admin/document-types').send({ value, flow })
    const list = await admin.get('/admin/document-types')
    const row = find(list.body, value)
    if (!row) throw new Error(`added type ${value} not found in listing`)
    return row.id
  }

  it('rejects a non-admin (403) on every verb — authz before existence', async () => {
    const nobody = request.agent(app.getHttpServer())
    await nobody.post('/auth/dev-login').send({ sub: 'u', email: 'plain@test.local', roles: ['Applicant'] })
    expect((await nobody.get('/admin/document-types')).status).toBe(403)
    expect((await nobody.patch('/admin/document-types/x').send({ active: false })).status).toBe(403)
    expect((await nobody.delete('/admin/document-types/x')).status).toBe(403)
  })

  it('never touches a NON-documentType option row (paymentTerm id → 404)', async () => {
    const admin = await adminAgent()
    // an option of a different kind — its id must be inert on the doc-type endpoints
    const opt = await admin.post('/admin/options/paymentTerm').send({ value: 'Net 30' })
    const otherId = opt.body.id

    expect((await admin.patch(`/admin/document-types/${otherId}`).send({ active: false })).status).toBe(404)
    expect((await admin.delete(`/admin/document-types/${otherId}`)).status).toBe(404)
    // the paymentTerm row is untouched (not hidden, not deleted)
    const row = await db.optionItem.findUnique({ where: { id: otherId } })
    expect(row).toMatchObject({ kind: 'paymentTerm', active: true })
  })

  it('lists all types (incl. hidden) with usage count, grouped by flow', async () => {
    const admin = await adminAgent()
    await admin.post('/admin/document-types').send({ value: 'Payment', flow: 'Payment' })
    const reqId = await addType(admin, 'Payment request', 'Payment')
    // one ticket uses "Payment" → usedBy = 1
    await db.ticket.create({
      data: { status: 'Submitted', flow: 'Payment', applicantSub: 'a', documentType: 'Payment' },
    })
    // hide "Payment request"
    await admin.patch(`/admin/document-types/${reqId}`).send({ active: false })

    const list = await admin.get('/admin/document-types')
    expect(list.status).toBe(200)
    const groups: DocTypeGroup[] = list.body
    expect(find(groups, 'Payment')).toMatchObject({ active: true, usedBy: 1 })
    // hidden type still present in the admin view (so it can be un-hidden)
    expect(find(groups, 'Payment request')).toMatchObject({ active: false, usedBy: 0 })

    // ...but the create-form projection shows ACTIVE only
    const form = await admin.get('/options/document-types')
    const formTypes = (form.body as DocTypeGroup[]).flatMap((g) => g.types as unknown as string[])
    expect(formTypes).toContain('Payment')
    expect(formTypes).not.toContain('Payment request')
  })

  it('hides then un-hides a type (reversible, soft)', async () => {
    const admin = await adminAgent()
    const id = await addType(admin, 'Advance request', 'Payment')

    const off = await admin.patch(`/admin/document-types/${id}`).send({ active: false })
    expect(off.status).toBe(200)
    expect(off.body.active).toBe(false)

    // hidden → gone from the create-form projection
    await admin.patch(`/admin/document-types/${id}`).send({ active: false })
    let form = (await admin.get('/options/document-types')).body as DocTypeGroup[]
    expect(form.flatMap((g) => g.types as unknown as string[])).not.toContain('Advance request')

    // un-hide → reappears in the projection (the real "reversible" contract)
    const on = await admin.patch(`/admin/document-types/${id}`).send({ active: true })
    expect(on.body.active).toBe(true)
    form = (await admin.get('/options/document-types')).body as DocTypeGroup[]
    expect(form.flatMap((g) => g.types as unknown as string[])).toContain('Advance request')
  })

  it('deletes a HIDDEN but unused type (hide-first-then-delete flow)', async () => {
    const admin = await adminAgent()
    const id = await addType(admin, 'Phụ lục Tạm', 'Contract')
    await admin.patch(`/admin/document-types/${id}`).send({ active: false })

    const del = await admin.delete(`/admin/document-types/${id}`)
    expect(del.status).toBe(200)
    expect(await db.optionItem.findUnique({ where: { id } })).toBeNull()
  })

  it('deletes a type that no ticket uses (usedBy = 0)', async () => {
    const admin = await adminAgent()
    const id = await addType(admin, 'Advance Clear', 'Payment')

    const del = await admin.delete(`/admin/document-types/${id}`)
    expect(del.status).toBe(200)
    expect(del.body).toEqual({ ok: true })
    expect(await db.optionItem.findUnique({ where: { id } })).toBeNull()
  })

  it('refuses to delete a type in use (409) — must hide instead', async () => {
    const admin = await adminAgent()
    const id = await addType(admin, 'Contract', 'Contract')
    await db.ticket.create({
      data: { status: 'Submitted', flow: 'Contract', applicantSub: 'a', documentType: 'Contract' },
    })

    const del = await admin.delete(`/admin/document-types/${id}`)
    expect(del.status).toBe(409)
    // still there
    expect(await db.optionItem.findUnique({ where: { id } })).not.toBeNull()
  })

  it('returns 404 deleting an unknown id', async () => {
    const admin = await adminAgent()
    expect((await admin.delete('/admin/document-types/does-not-exist')).status).toBe(404)
  })
})
